import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import {
  copyToClipboard,
  defaultClipboardRunner,
  UnsupportedPlatformError,
  type ClipboardRunner,
} from '../src/p2-clipboard/index.js';
import { createClipboardRouter } from '../src/routes/clipboard.js';
import { registerApiRoutes } from '../src/routes/index.js';
import { createServer } from '../src/server.js';
import {
  openDatabase,
  type DatabaseInstance,
} from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChecklistFile } from '@onboarding/shared';

const silentLogger = pino({ level: 'silent' });

describe('copyToClipboard (p2-clipboard/index.ts)', () => {
  it('invokes runner with the raw text on darwin (AC-P2-01 stdin payload)', async () => {
    const runner: ClipboardRunner = vi.fn().mockResolvedValue(undefined);
    await copyToClipboard('echo hi', { runner, platform: 'darwin' });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith('echo hi');
  });

  it('does not modify multibyte / multiline payloads', async () => {
    const runner: ClipboardRunner = vi.fn().mockResolvedValue(undefined);
    const text = 'echo "안녕"\nls -la\n';
    await copyToClipboard(text, { runner, platform: 'darwin' });
    expect(runner).toHaveBeenCalledWith(text);
  });

  it('throws UnsupportedPlatformError on linux', async () => {
    const runner: ClipboardRunner = vi.fn();
    await expect(
      copyToClipboard('echo hi', { runner, platform: 'linux' }),
    ).rejects.toBeInstanceOf(UnsupportedPlatformError);
    expect(runner).not.toHaveBeenCalled();
  });

  it('throws UnsupportedPlatformError on win32', async () => {
    const runner: ClipboardRunner = vi.fn();
    await expect(
      copyToClipboard('echo hi', { runner, platform: 'win32' }),
    ).rejects.toBeInstanceOf(UnsupportedPlatformError);
    expect(runner).not.toHaveBeenCalled();
  });

  it('UnsupportedPlatformError exposes code "unsupported_platform"', () => {
    const err = new UnsupportedPlatformError();
    expect(err.code).toBe('unsupported_platform');
    expect(err.message).toBe('unsupported_platform');
    expect(err).toBeInstanceOf(Error);
  });

  it('propagates runner failures', async () => {
    const runner: ClipboardRunner = vi
      .fn()
      .mockRejectedValue(new Error('pbcopy failed'));
    await expect(
      copyToClipboard('echo hi', { runner, platform: 'darwin' }),
    ).rejects.toThrow('pbcopy failed');
  });

  describe('defaultClipboardRunner', () => {
    it('is a function (real pbcopy is darwin-only and skipped here)', () => {
      expect(typeof defaultClipboardRunner).toBe('function');
    });

    it('actually invokes pbcopy and writes payload to system clipboard on darwin (AC-P2-01)', async () => {
      if (process.platform !== 'darwin') {
        return;
      }
      const { execa } = await import('execa');
      const marker = `ralphton-clipboard-test-${Date.now()}`;
      await defaultClipboardRunner(marker);
      const { stdout } = await execa('pbpaste');
      expect(stdout).toBe(marker);
    });
  });
});

describe('POST /api/clipboard', () => {
  function buildApp(opts: {
    runner?: ClipboardRunner;
    platform?: NodeJS.Platform;
  } = {}) {
    return createServer({
      logger: silentLogger,
      registerRoutes: (app) => {
        app.use(
          createClipboardRouter({
            runner: opts.runner ?? (vi.fn().mockResolvedValue(undefined) as ClipboardRunner),
            platform: opts.platform ?? 'darwin',
          }),
        );
      },
    });
  }

  it('200 { ok: true } on a valid command and forwards to runner (AC-P2-01)', async () => {
    const runner: ClipboardRunner = vi.fn().mockResolvedValue(undefined);
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/clipboard')
      .send({ command: 'echo hi' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(runner).toHaveBeenCalledWith('echo hi');
  });

  it('responds in well under 200ms for a typical command', async () => {
    const runner: ClipboardRunner = vi.fn().mockResolvedValue(undefined);
    const app = buildApp({ runner });
    const start = Date.now();
    await request(app)
      .post('/api/clipboard')
      .send({ command: 'brew install jq' })
      .expect(200);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('400 validation_error when command is empty string', async () => {
    const runner: ClipboardRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/clipboard')
      .send({ command: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(runner).not.toHaveBeenCalled();
  });

  it('400 validation_error when command is missing', async () => {
    const runner: ClipboardRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app).post('/api/clipboard').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(runner).not.toHaveBeenCalled();
  });

  it('400 validation_error when command is not a string', async () => {
    const runner: ClipboardRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/clipboard')
      .send({ command: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(runner).not.toHaveBeenCalled();
  });

  it('413 payload_too_large when command exceeds 32KB', async () => {
    const runner: ClipboardRunner = vi.fn();
    const app = buildApp({ runner });
    const oversized = 'a'.repeat(32 * 1024 + 1);
    const res = await request(app)
      .post('/api/clipboard')
      .send({ command: oversized });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('payload_too_large');
    expect(runner).not.toHaveBeenCalled();
  });

  it('accepts a command exactly at the 32KB boundary (32768 bytes)', async () => {
    const runner: ClipboardRunner = vi.fn().mockResolvedValue(undefined);
    const app = buildApp({ runner });
    const exact = 'a'.repeat(32 * 1024);
    const res = await request(app)
      .post('/api/clipboard')
      .send({ command: exact });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(runner).toHaveBeenCalledWith(exact);
  });

  it('measures payload in bytes, not chars (multibyte chars over 32KB → 413)', async () => {
    const runner: ClipboardRunner = vi.fn();
    const app = buildApp({ runner });
    // A 3-byte UTF-8 character; 11000 of them = 33000 bytes (> 32768)
    const oversizedUtf8 = '한'.repeat(11000);
    const res = await request(app)
      .post('/api/clipboard')
      .send({ command: oversizedUtf8 });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('payload_too_large');
    expect(runner).not.toHaveBeenCalled();
  });

  it('500 unsupported_platform on non-macOS', async () => {
    const runner: ClipboardRunner = vi.fn();
    const app = buildApp({ runner, platform: 'linux' });
    const res = await request(app)
      .post('/api/clipboard')
      .send({ command: 'echo hi' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('unsupported_platform');
    expect(runner).not.toHaveBeenCalled();
  });

  it('surfaces an internal error from the runner as 500', async () => {
    const runner: ClipboardRunner = vi
      .fn()
      .mockRejectedValue(new Error('pbcopy crashed'));
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/clipboard')
      .send({ command: 'echo hi' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_server_error');
  });
});

describe('clipboard route is registered via registerApiRoutes', () => {
  it('POST /api/clipboard goes through registerApiRoutes', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-clipboard-routes-'));
    const db: DatabaseInstance = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
    try {
      const checklist: ChecklistFile = {
        version: 2,
        schema: 'ai-coaching',
        items: [],
      };
      const runner: ClipboardRunner = vi.fn().mockResolvedValue(undefined);
      const app = createServer({
        logger: silentLogger,
        registerRoutes: (a) => {
          registerApiRoutes(a, {
            checklist,
            db,
            clipboardRunner: runner,
            clipboardPlatform: 'darwin',
          });
        },
      });
      const res = await request(app)
        .post('/api/clipboard')
        .send({ command: 'echo hi' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(runner).toHaveBeenCalledWith('echo hi');
    } finally {
      db.close();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
