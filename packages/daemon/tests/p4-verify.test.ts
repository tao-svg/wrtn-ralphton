import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ChecklistFile } from '@onboarding/shared';
import pino from 'pino';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openDatabase, type DatabaseInstance } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import {
  defaultVerifyRunner,
  ItemNotFoundError,
  runVerify,
  VerificationMissingError,
  VERIFY_TIMEOUT_MS,
  type VerifyRunner,
} from '../src/p4-verify/index.js';
import { createVerifyRouter } from '../src/routes/verify.js';
import { registerApiRoutes } from '../src/routes/index.js';
import { createServer } from '../src/server.js';

const silentLogger = pino({ level: 'silent' });

const FIXTURE_CHECKLIST: ChecklistFile = {
  version: 2,
  schema: 'ai-coaching',
  items: [
    {
      id: 'install-homebrew',
      title: 'Homebrew',
      estimated_minutes: 3,
      verification: {
        type: 'command',
        command: 'brew --version',
      },
    },
    {
      id: 'configure-git',
      title: 'Git',
      estimated_minutes: 1,
      verification: {
        type: 'command',
        command: 'git config --global user.email',
        expect_contains: 'tao@wrtn.io',
      },
    },
    {
      id: 'install-security-agent',
      title: 'Security agent',
      estimated_minutes: 15,
      verification: {
        type: 'process_check',
        process_name: 'SecurityAgent',
      },
    },
    {
      id: 'no-verification',
      title: 'No probe',
      estimated_minutes: 1,
    },
  ],
};

interface ItemStateRow {
  item_id: string;
  status: string;
  current_step: string | null;
  started_at: number | null;
  completed_at: number | null;
  attempt_count: number;
}

function readState(db: DatabaseInstance, itemId: string): ItemStateRow | undefined {
  return db
    .prepare('SELECT * FROM item_states WHERE item_id = ?')
    .get(itemId) as ItemStateRow | undefined;
}

describe('runVerify (p4-verify/index.ts)', () => {
  let tmpDir: string;
  let db: DatabaseInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-p4-verify-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('command verification', () => {
    it('returns pass and marks item completed when exit code is 0 (AC-P4-01)', async () => {
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: 'Homebrew 4.3.0',
        exitCode: 0,
        timedOut: false,
      });
      const fixedNow = 1_700_000_000_000;

      const result = await runVerify('install-homebrew', {
        checklist: FIXTURE_CHECKLIST,
        db,
        runner,
        now: () => fixedNow,
        logger: silentLogger,
      });

      expect(result.status).toBe('pass');
      expect(runner).toHaveBeenCalledWith('brew --version');

      const state = readState(db, 'install-homebrew');
      expect(state?.status).toBe('completed');
      expect(state?.completed_at).toBe(fixedNow);
      expect(state?.attempt_count).toBe(1);
    });

    it('returns fail and increments attempt_count when exit code is non-zero', async () => {
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: 'command not found',
        exitCode: 127,
        timedOut: false,
      });

      const result = await runVerify('install-homebrew', {
        checklist: FIXTURE_CHECKLIST,
        db,
        runner,
        logger: silentLogger,
      });

      expect(result.status).toBe('fail');
      expect(result.details).toContain('exit');
      expect(result.details).toContain('127');

      const state = readState(db, 'install-homebrew');
      expect(state?.status).not.toBe('completed');
      expect(state?.attempt_count).toBe(1);
    });

    it('preserves existing in_progress status on FAIL but bumps attempt_count', async () => {
      db.prepare(
        `INSERT INTO item_states
           (item_id, status, current_step, started_at, completed_at, attempt_count)
         VALUES ('install-homebrew', 'in_progress', NULL, 999, NULL, 2)`,
      ).run();

      const runner: VerifyRunner = vi
        .fn()
        .mockResolvedValue({ stdout: '', exitCode: 1, timedOut: false });

      const result = await runVerify('install-homebrew', {
        checklist: FIXTURE_CHECKLIST,
        db,
        runner,
        logger: silentLogger,
      });

      expect(result.status).toBe('fail');
      const state = readState(db, 'install-homebrew');
      expect(state?.status).toBe('in_progress');
      expect(state?.started_at).toBe(999);
      expect(state?.attempt_count).toBe(3);
    });

    it('returns pass when expect_contains matches stdout', async () => {
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: 'tao@wrtn.io\n',
        exitCode: 0,
        timedOut: false,
      });

      const result = await runVerify('configure-git', {
        checklist: FIXTURE_CHECKLIST,
        db,
        runner,
      });

      expect(result.status).toBe('pass');
      expect(readState(db, 'configure-git')?.status).toBe('completed');
    });

    it('returns fail with details when expect_contains does not match', async () => {
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: 'someone-else@example.com\n',
        exitCode: 0,
        timedOut: false,
      });

      const result = await runVerify('configure-git', {
        checklist: FIXTURE_CHECKLIST,
        db,
        runner,
      });

      expect(result.status).toBe('fail');
      expect(result.details).toContain('tao@wrtn.io');
      expect(result.details).toContain('someone-else@example.com');

      const state = readState(db, 'configure-git');
      expect(state?.status).not.toBe('completed');
      expect(state?.attempt_count).toBe(1);
    });

    it('returns fail with timeout message when runner reports timedOut', async () => {
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: '',
        exitCode: 1,
        timedOut: true,
      });

      const result = await runVerify('install-homebrew', {
        checklist: FIXTURE_CHECKLIST,
        db,
        runner,
      });

      expect(result.status).toBe('fail');
      expect(result.details).toContain('timeout');
    });

    it('returns fail when runner throws an error', async () => {
      const runner: VerifyRunner = vi
        .fn()
        .mockRejectedValue(new Error('spawn error: ENOENT'));

      const result = await runVerify('install-homebrew', {
        checklist: FIXTURE_CHECKLIST,
        db,
        runner,
      });

      expect(result.status).toBe('fail');
      expect(result.details).toContain('ENOENT');

      const state = readState(db, 'install-homebrew');
      expect(state?.attempt_count).toBe(1);
    });

    it('truncates stdout in details to at most 1KB', async () => {
      const huge = 'a'.repeat(5000);
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: huge,
        exitCode: 1,
        timedOut: false,
      });

      const result = await runVerify('install-homebrew', {
        checklist: FIXTURE_CHECKLIST,
        db,
        runner,
      });

      expect(result.status).toBe('fail');
      // details should not contain the entire 5000-char stdout
      expect(result.details.length).toBeLessThanOrEqual(2048);
    });

    it('uses the body verification override when given', async () => {
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: 'overridden',
        exitCode: 0,
        timedOut: false,
      });

      const result = await runVerify('install-homebrew', {
        checklist: FIXTURE_CHECKLIST,
        db,
        verification: {
          type: 'command',
          command: 'echo overridden',
        },
        runner,
      });

      expect(result.status).toBe('pass');
      expect(runner).toHaveBeenCalledWith('echo overridden');
    });
  });

  describe('process_check verification', () => {
    it('returns pass when pgrep exits 0 and prints a PID', async () => {
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: '12345\n',
        exitCode: 0,
        timedOut: false,
      });
      const fixedNow = 1_700_000_000_000;

      const result = await runVerify('install-security-agent', {
        checklist: FIXTURE_CHECKLIST,
        db,
        runner,
        now: () => fixedNow,
      });

      expect(result.status).toBe('pass');
      expect(runner).toHaveBeenCalledWith('pgrep SecurityAgent');

      const state = readState(db, 'install-security-agent');
      expect(state?.status).toBe('completed');
      expect(state?.completed_at).toBe(fixedNow);
      expect(state?.attempt_count).toBe(1);
    });

    it('returns fail when pgrep exits non-zero', async () => {
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: '',
        exitCode: 1,
        timedOut: false,
      });

      const result = await runVerify('install-security-agent', {
        checklist: FIXTURE_CHECKLIST,
        db,
        runner,
      });

      expect(result.status).toBe('fail');
      expect(result.details).toContain('process');

      const state = readState(db, 'install-security-agent');
      expect(state?.status).not.toBe('completed');
      expect(state?.attempt_count).toBe(1);
    });

    it('returns fail when pgrep exits 0 but stdout is empty', async () => {
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: '\n',
        exitCode: 0,
        timedOut: false,
      });

      const result = await runVerify('install-security-agent', {
        checklist: FIXTURE_CHECKLIST,
        db,
        runner,
      });

      expect(result.status).toBe('fail');
    });
  });

  describe('errors', () => {
    it('throws ItemNotFoundError when itemId is not in checklist', async () => {
      const runner: VerifyRunner = vi.fn();
      await expect(
        runVerify('does-not-exist', {
          checklist: FIXTURE_CHECKLIST,
          db,
          runner,
        }),
      ).rejects.toBeInstanceOf(ItemNotFoundError);
      expect(runner).not.toHaveBeenCalled();
    });

    it('throws VerificationMissingError when item has no verification and no override', async () => {
      const runner: VerifyRunner = vi.fn();
      await expect(
        runVerify('no-verification', {
          checklist: FIXTURE_CHECKLIST,
          db,
          runner,
        }),
      ).rejects.toBeInstanceOf(VerificationMissingError);
      expect(runner).not.toHaveBeenCalled();
    });

    it('uses override even when item has no yaml verification', async () => {
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: 'ok',
        exitCode: 0,
        timedOut: false,
      });

      const result = await runVerify('no-verification', {
        checklist: FIXTURE_CHECKLIST,
        db,
        verification: { type: 'command', command: 'echo ok' },
        runner,
      });

      expect(result.status).toBe('pass');
    });
  });
});

describe('defaultVerifyRunner', () => {
  it('exposes a 30-second timeout (AC: command 실행 timeout 30초)', () => {
    expect(VERIFY_TIMEOUT_MS).toBe(30_000);
  });

  it('runs a real shell command and returns stdout/exitCode (exit 0)', async () => {
    const out = await defaultVerifyRunner(
      'node -e "process.stdout.write(\'hello\')"',
    );
    expect(out.exitCode).toBe(0);
    expect(out.stdout).toContain('hello');
    expect(out.timedOut).toBe(false);
  });

  it('returns non-zero exitCode when the command fails', async () => {
    const out = await defaultVerifyRunner('node -e "process.exit(7)"');
    expect(out.exitCode).toBe(7);
    expect(out.timedOut).toBe(false);
  });
});

describe('POST /api/verify/run', () => {
  let tmpDir: string;
  let db: DatabaseInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-p4-verify-route-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function buildApp(opts: {
    checklist?: ChecklistFile;
    runner?: VerifyRunner;
    now?: () => number;
  } = {}) {
    return createServer({
      logger: silentLogger,
      registerRoutes: (app) => {
        app.use(
          createVerifyRouter({
            checklist: opts.checklist ?? FIXTURE_CHECKLIST,
            db,
            runner: opts.runner,
            now: opts.now,
            logger: silentLogger,
          }),
        );
      },
    });
  }

  it('200 { status: "pass" } when command verification passes (AC-P4-01)', async () => {
    const runner: VerifyRunner = vi.fn().mockResolvedValue({
      stdout: 'Homebrew 4.3.0',
      exitCode: 0,
      timedOut: false,
    });
    const fixedNow = 1_700_000_000_000;

    const app = buildApp({ runner, now: () => fixedNow });

    const res = await request(app)
      .post('/api/verify/run')
      .send({ item_id: 'install-homebrew' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pass');
    expect(typeof res.body.details).toBe('string');

    const state = readState(db, 'install-homebrew');
    expect(state?.status).toBe('completed');
    expect(state?.completed_at).toBe(fixedNow);
  });

  it('200 { status: "fail", details } when verification fails', async () => {
    const runner: VerifyRunner = vi.fn().mockResolvedValue({
      stdout: 'wrong output',
      exitCode: 1,
      timedOut: false,
    });

    const app = buildApp({ runner });

    const res = await request(app)
      .post('/api/verify/run')
      .send({ item_id: 'install-homebrew' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('fail');
    expect(res.body.details).toContain('1');

    const state = readState(db, 'install-homebrew');
    expect(state?.status).not.toBe('completed');
    expect(state?.attempt_count).toBe(1);
  });

  it('uses body.verification override when present', async () => {
    const runner: VerifyRunner = vi.fn().mockResolvedValue({
      stdout: '',
      exitCode: 0,
      timedOut: false,
    });

    const app = buildApp({ runner });

    const res = await request(app)
      .post('/api/verify/run')
      .send({
        item_id: 'install-homebrew',
        verification: { type: 'command', command: 'true' },
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pass');
    expect(runner).toHaveBeenCalledWith('true');
  });

  it('404 item_not_found when item_id is unknown', async () => {
    const runner: VerifyRunner = vi.fn();
    const app = buildApp({ runner });

    const res = await request(app)
      .post('/api/verify/run')
      .send({ item_id: 'does-not-exist' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('item_not_found');
    expect(runner).not.toHaveBeenCalled();
  });

  it('400 verification_missing when item has no verification and body has none', async () => {
    const runner: VerifyRunner = vi.fn();
    const app = buildApp({ runner });

    const res = await request(app)
      .post('/api/verify/run')
      .send({ item_id: 'no-verification' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('verification_missing');
    expect(runner).not.toHaveBeenCalled();
  });

  it('400 validation_error when item_id is missing', async () => {
    const runner: VerifyRunner = vi.fn();
    const app = buildApp({ runner });

    const res = await request(app).post('/api/verify/run').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(runner).not.toHaveBeenCalled();
  });

  it('400 validation_error when verification override is malformed', async () => {
    const runner: VerifyRunner = vi.fn();
    const app = buildApp({ runner });

    const res = await request(app).post('/api/verify/run').send({
      item_id: 'install-homebrew',
      verification: { type: 'unknown' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(runner).not.toHaveBeenCalled();
  });

  it('process_check route round-trip (AC: pgrep PID → pass)', async () => {
    const runner: VerifyRunner = vi.fn().mockResolvedValue({
      stdout: '4242\n',
      exitCode: 0,
      timedOut: false,
    });

    const app = buildApp({ runner });

    const res = await request(app)
      .post('/api/verify/run')
      .send({ item_id: 'install-security-agent' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pass');
    expect(runner).toHaveBeenCalledWith('pgrep SecurityAgent');
  });
});

describe('verify route is registered via registerApiRoutes', () => {
  it('POST /api/verify/run goes through registerApiRoutes', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-verify-routes-'));
    const db: DatabaseInstance = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
    try {
      const runner: VerifyRunner = vi.fn().mockResolvedValue({
        stdout: 'ok',
        exitCode: 0,
        timedOut: false,
      });
      const app = createServer({
        logger: silentLogger,
        registerRoutes: (a) => {
          registerApiRoutes(a, {
            checklist: FIXTURE_CHECKLIST,
            db,
            verifyRunner: runner,
          });
        },
      });
      const res = await request(app)
        .post('/api/verify/run')
        .send({ item_id: 'install-homebrew' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pass');
    } finally {
      db.close();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
