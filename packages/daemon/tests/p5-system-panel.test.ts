import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ChecklistFile } from '@onboarding/shared';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { openDatabase, type DatabaseInstance } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import {
  ALLOWED_URL_PREFIXES,
  defaultSystemPanelRunner,
  InvalidPanelUrlError,
  isAllowedPanelUrl,
  launchSystemPanel,
  UnsupportedPlatformError,
  type SystemPanelRunner,
} from '../src/p5-system-panel/index.js';
import { registerApiRoutes } from '../src/routes/index.js';
import { createSystemPanelRouter } from '../src/routes/system-panel.js';
import { createServer } from '../src/server.js';

const silentLogger = pino({ level: 'silent' });

const FIXTURE_CHECKLIST: ChecklistFile = {
  version: 2,
  schema: 'ai-coaching',
  items: [
    {
      id: 'install-security-agent',
      title: 'Security agent',
      estimated_minutes: 15,
      ai_coaching: {
        overall_goal: 'Install security agent and grant permissions',
        steps: [
          {
            id: 'download',
            intent: 'Download',
            success_criteria: '~/Downloads has the pkg',
          },
          {
            id: 'grant_permission',
            intent: 'Grant permission',
            success_criteria: 'pgrep returns pid',
            system_panel_url:
              'x-apple.systempreferences:com.apple.preference.security',
          },
        ],
      },
    },
    {
      id: 'setup-vpn',
      title: 'VPN',
      estimated_minutes: 10,
      ai_coaching: {
        overall_goal: 'Configure VPN profile',
        steps: [
          {
            id: 'install_profile',
            intent: 'Install profile',
            success_criteria: 'profile shown',
            system_panel_url:
              'x-apple.systempreferences:com.apple.preferences.configurationprofiles',
          },
        ],
      },
    },
  ],
};

describe('launchSystemPanel (p5-system-panel/index.ts)', () => {
  it('invokes runner with the URL on darwin (AC-P5P-01)', async () => {
    const runner: SystemPanelRunner = vi.fn().mockResolvedValue(undefined);
    await launchSystemPanel(
      'x-apple.systempreferences:com.apple.preference.security',
      { runner, platform: 'darwin' },
    );
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.preference.security',
    );
  });

  it('passes https:// URL through to runner', async () => {
    const runner: SystemPanelRunner = vi.fn().mockResolvedValue(undefined);
    await launchSystemPanel('https://vpn.wrtn.ax/profile', {
      runner,
      platform: 'darwin',
    });
    expect(runner).toHaveBeenCalledWith('https://vpn.wrtn.ax/profile');
  });

  it('passes file:// URL through to runner', async () => {
    const runner: SystemPanelRunner = vi.fn().mockResolvedValue(undefined);
    await launchSystemPanel('file:///etc/passwd', {
      runner,
      platform: 'darwin',
    });
    expect(runner).toHaveBeenCalledWith('file:///etc/passwd');
  });

  it('throws InvalidPanelUrlError for javascript: scheme', async () => {
    const runner: SystemPanelRunner = vi.fn();
    await expect(
      launchSystemPanel('javascript:alert(1)', {
        runner,
        platform: 'darwin',
      }),
    ).rejects.toBeInstanceOf(InvalidPanelUrlError);
    expect(runner).not.toHaveBeenCalled();
  });

  it('throws InvalidPanelUrlError for http:// (only https:// allowed)', async () => {
    const runner: SystemPanelRunner = vi.fn();
    await expect(
      launchSystemPanel('http://insecure.example.com', {
        runner,
        platform: 'darwin',
      }),
    ).rejects.toBeInstanceOf(InvalidPanelUrlError);
    expect(runner).not.toHaveBeenCalled();
  });

  it('throws InvalidPanelUrlError for plain shell command', async () => {
    const runner: SystemPanelRunner = vi.fn();
    await expect(
      launchSystemPanel('rm -rf /', { runner, platform: 'darwin' }),
    ).rejects.toBeInstanceOf(InvalidPanelUrlError);
    expect(runner).not.toHaveBeenCalled();
  });

  it('throws InvalidPanelUrlError for empty string', async () => {
    const runner: SystemPanelRunner = vi.fn();
    await expect(
      launchSystemPanel('', { runner, platform: 'darwin' }),
    ).rejects.toBeInstanceOf(InvalidPanelUrlError);
    expect(runner).not.toHaveBeenCalled();
  });

  it('throws UnsupportedPlatformError on linux', async () => {
    const runner: SystemPanelRunner = vi.fn();
    await expect(
      launchSystemPanel('https://example.com', {
        runner,
        platform: 'linux',
      }),
    ).rejects.toBeInstanceOf(UnsupportedPlatformError);
    expect(runner).not.toHaveBeenCalled();
  });

  it('throws UnsupportedPlatformError on win32', async () => {
    const runner: SystemPanelRunner = vi.fn();
    await expect(
      launchSystemPanel('https://example.com', {
        runner,
        platform: 'win32',
      }),
    ).rejects.toBeInstanceOf(UnsupportedPlatformError);
    expect(runner).not.toHaveBeenCalled();
  });

  it('checks URL allowlist BEFORE platform check (security first)', async () => {
    const runner: SystemPanelRunner = vi.fn();
    await expect(
      launchSystemPanel('javascript:alert(1)', {
        runner,
        platform: 'linux',
      }),
    ).rejects.toBeInstanceOf(InvalidPanelUrlError);
  });

  it('UnsupportedPlatformError exposes code "unsupported_platform"', () => {
    const err = new UnsupportedPlatformError();
    expect(err.code).toBe('unsupported_platform');
    expect(err.message).toBe('unsupported_platform');
    expect(err).toBeInstanceOf(Error);
  });

  it('InvalidPanelUrlError exposes code "invalid_panel_url" and url', () => {
    const err = new InvalidPanelUrlError('javascript:foo');
    expect(err.code).toBe('invalid_panel_url');
    expect(err.url).toBe('javascript:foo');
    expect(err.message).toContain('javascript:foo');
    expect(err).toBeInstanceOf(Error);
  });

  it('propagates runner failures (e.g. open exits non-zero)', async () => {
    const runner: SystemPanelRunner = vi
      .fn()
      .mockRejectedValue(new Error('open failed'));
    await expect(
      launchSystemPanel('https://example.com', {
        runner,
        platform: 'darwin',
      }),
    ).rejects.toThrow('open failed');
  });

  describe('isAllowedPanelUrl', () => {
    it('returns true for x-apple.systempreferences:', () => {
      expect(
        isAllowedPanelUrl(
          'x-apple.systempreferences:com.apple.preference.security',
        ),
      ).toBe(true);
    });

    it('returns true for https://', () => {
      expect(isAllowedPanelUrl('https://example.com')).toBe(true);
    });

    it('returns true for file://', () => {
      expect(isAllowedPanelUrl('file:///etc/passwd')).toBe(true);
    });

    it('returns false for javascript:', () => {
      expect(isAllowedPanelUrl('javascript:alert(1)')).toBe(false);
    });

    it('returns false for http://', () => {
      expect(isAllowedPanelUrl('http://example.com')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isAllowedPanelUrl('')).toBe(false);
    });

    it('exposes the allowlist as readonly tuple', () => {
      expect(ALLOWED_URL_PREFIXES).toEqual([
        'x-apple.systempreferences:',
        'https://',
        'file://',
      ]);
    });
  });

  describe('defaultSystemPanelRunner', () => {
    it('is a function (real `open` is darwin-only and skipped here)', () => {
      expect(typeof defaultSystemPanelRunner).toBe('function');
    });
  });
});

describe('POST /api/system-panel/launch', () => {
  function buildApp(opts: {
    checklist?: ChecklistFile;
    runner?: SystemPanelRunner;
    platform?: NodeJS.Platform;
  } = {}) {
    return createServer({
      logger: silentLogger,
      registerRoutes: (app) => {
        app.use(
          createSystemPanelRouter({
            checklist: opts.checklist ?? FIXTURE_CHECKLIST,
            runner:
              opts.runner ??
              (vi.fn().mockResolvedValue(undefined) as SystemPanelRunner),
            platform: opts.platform ?? 'darwin',
          }),
        );
      },
    });
  }

  it('200 { ok: true, url } for direct allowlisted URL (AC-P5P-01)', async () => {
    const runner: SystemPanelRunner = vi.fn().mockResolvedValue(undefined);
    const app = buildApp({ runner });
    const url = 'x-apple.systempreferences:com.apple.preference.security';
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ url });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, url });
    expect(runner).toHaveBeenCalledWith(url);
  });

  it('200 looks up system_panel_url from yaml when item_id+step_id provided', async () => {
    const runner: SystemPanelRunner = vi.fn().mockResolvedValue(undefined);
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ item_id: 'install-security-agent', step_id: 'grant_permission' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.url).toBe(
      'x-apple.systempreferences:com.apple.preference.security',
    );
    expect(runner).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.preference.security',
    );
  });

  it('400 invalid_panel_url for javascript: scheme', async () => {
    const runner: SystemPanelRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ url: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_panel_url');
    expect(runner).not.toHaveBeenCalled();
  });

  it('400 invalid_panel_url for http://', async () => {
    const runner: SystemPanelRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ url: 'http://insecure.example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_panel_url');
    expect(runner).not.toHaveBeenCalled();
  });

  it('200 file:// is on the allowlist (informational; URL filtering, not access control)', async () => {
    const runner: SystemPanelRunner = vi.fn().mockResolvedValue(undefined);
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ url: 'file:///etc/passwd' });
    expect(res.status).toBe(200);
    expect(runner).toHaveBeenCalledWith('file:///etc/passwd');
  });

  it('400 validation_error when neither url nor item_id/step_id is provided', async () => {
    const runner: SystemPanelRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app).post('/api/system-panel/launch').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(runner).not.toHaveBeenCalled();
  });

  it('400 validation_error when only item_id is provided (missing step_id)', async () => {
    const runner: SystemPanelRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ item_id: 'install-security-agent' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(runner).not.toHaveBeenCalled();
  });

  it('400 validation_error when url is empty string', async () => {
    const runner: SystemPanelRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ url: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(runner).not.toHaveBeenCalled();
  });

  it('400 validation_error when extra unknown key is sent (strict)', async () => {
    const runner: SystemPanelRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ url: 'https://example.com', evil: 'extra' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(runner).not.toHaveBeenCalled();
  });

  it('404 item_not_found when item_id does not exist', async () => {
    const runner: SystemPanelRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ item_id: 'does-not-exist', step_id: 'foo' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('item_not_found');
    expect(runner).not.toHaveBeenCalled();
  });

  it('404 step_not_found when item exists but step_id does not', async () => {
    const runner: SystemPanelRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ item_id: 'install-security-agent', step_id: 'no-such-step' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('step_not_found');
    expect(runner).not.toHaveBeenCalled();
  });

  it('400 panel_url_not_defined when step has no system_panel_url', async () => {
    const runner: SystemPanelRunner = vi.fn();
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ item_id: 'install-security-agent', step_id: 'download' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('panel_url_not_defined');
    expect(runner).not.toHaveBeenCalled();
  });

  it('400 panel_url_not_defined when item has no ai_coaching at all', async () => {
    const checklist: ChecklistFile = {
      version: 2,
      schema: 'ai-coaching',
      items: [
        {
          id: 'no-coaching',
          title: 'No coaching',
          estimated_minutes: 1,
        },
      ],
    };
    const runner: SystemPanelRunner = vi.fn();
    const app = buildApp({ checklist, runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ item_id: 'no-coaching', step_id: 'whatever' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('step_not_found');
    expect(runner).not.toHaveBeenCalled();
  });

  it('500 unsupported_platform on non-macOS for valid URL', async () => {
    const runner: SystemPanelRunner = vi.fn();
    const app = buildApp({ runner, platform: 'linux' });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ url: 'https://example.com' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('unsupported_platform');
    expect(runner).not.toHaveBeenCalled();
  });

  it('500 internal_server_error when runner throws unknown error', async () => {
    const runner: SystemPanelRunner = vi
      .fn()
      .mockRejectedValue(new Error('open crashed'));
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({ url: 'https://example.com' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_server_error');
  });

  it('prefers explicit url over item_id+step_id when both are provided', async () => {
    const runner: SystemPanelRunner = vi.fn().mockResolvedValue(undefined);
    const app = buildApp({ runner });
    const res = await request(app)
      .post('/api/system-panel/launch')
      .send({
        url: 'https://override.example',
        item_id: 'install-security-agent',
        step_id: 'grant_permission',
      });
    expect(res.status).toBe(200);
    expect(runner).toHaveBeenCalledWith('https://override.example');
    expect(res.body.url).toBe('https://override.example');
  });
});

describe('system-panel route is registered via registerApiRoutes', () => {
  it('POST /api/system-panel/launch goes through registerApiRoutes', async () => {
    const tmpDir = mkdtempSync(
      join(tmpdir(), 'onboarding-system-panel-routes-'),
    );
    const db: DatabaseInstance = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
    try {
      const runner: SystemPanelRunner = vi.fn().mockResolvedValue(undefined);
      const app = createServer({
        logger: silentLogger,
        registerRoutes: (a) => {
          registerApiRoutes(a, {
            checklist: FIXTURE_CHECKLIST,
            db,
            systemPanelRunner: runner,
            systemPanelPlatform: 'darwin',
          });
        },
      });
      const res = await request(app)
        .post('/api/system-panel/launch')
        .send({
          item_id: 'install-security-agent',
          step_id: 'grant_permission',
        });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(runner).toHaveBeenCalledWith(
        'x-apple.systempreferences:com.apple.preference.security',
      );
    } finally {
      db.close();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
