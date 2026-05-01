import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ChecklistFile } from '@onboarding/shared';
import pino from 'pino';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openDatabase, type DatabaseInstance } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { runStateProbe } from '../src/p1-state-probe/index.js';
import {
  defaultProbeRunner,
  runProbe,
  type ProbeRunner,
} from '../src/p1-state-probe/probes.js';
import { createStateProbeRouter } from '../src/routes/state-probe.js';
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

describe('runProbe (probes.ts)', () => {
  describe('command verification', () => {
    it('returns PASS when exit code is 0 and no expect_contains is given', async () => {
      const runner: ProbeRunner = vi
        .fn()
        .mockResolvedValue({ stdout: 'Homebrew 4.3.0', exitCode: 0 });
      const result = await runProbe(
        { type: 'command', command: 'brew --version' },
        runner,
      );
      expect(result.status).toBe('PASS');
      expect(runner).toHaveBeenCalledWith('brew --version');
    });

    it('returns FAIL when exit code is non-zero', async () => {
      const runner: ProbeRunner = vi
        .fn()
        .mockResolvedValue({ stdout: '', exitCode: 1 });
      const result = await runProbe(
        { type: 'command', command: 'brew --version' },
        runner,
      );
      expect(result.status).toBe('FAIL');
    });

    it('returns PASS when expect_contains matches stdout', async () => {
      const runner: ProbeRunner = vi
        .fn()
        .mockResolvedValue({ stdout: 'tao@wrtn.io\n', exitCode: 0 });
      const result = await runProbe(
        {
          type: 'command',
          command: 'git config --global user.email',
          expect_contains: 'tao@wrtn.io',
        },
        runner,
      );
      expect(result.status).toBe('PASS');
    });

    it('returns FAIL when expect_contains does not match', async () => {
      const runner: ProbeRunner = vi
        .fn()
        .mockResolvedValue({ stdout: 'someone-else@example.com\n', exitCode: 0 });
      const result = await runProbe(
        {
          type: 'command',
          command: 'git config --global user.email',
          expect_contains: 'tao@wrtn.io',
        },
        runner,
      );
      expect(result.status).toBe('FAIL');
    });

    it('returns FAIL when runner throws', async () => {
      const runner: ProbeRunner = vi
        .fn()
        .mockRejectedValue(new Error('command not found'));
      const result = await runProbe(
        { type: 'command', command: 'nonsense' },
        runner,
      );
      expect(result.status).toBe('FAIL');
    });
  });

  describe('process_check verification', () => {
    it('returns PASS when pgrep exits 0 and prints a PID', async () => {
      const runner: ProbeRunner = vi
        .fn()
        .mockResolvedValue({ stdout: '12345\n', exitCode: 0 });
      const result = await runProbe(
        { type: 'process_check', process_name: 'SecurityAgent' },
        runner,
      );
      expect(result.status).toBe('PASS');
      expect(runner).toHaveBeenCalledWith('pgrep SecurityAgent');
    });

    it('returns FAIL when pgrep exits non-zero (process not running)', async () => {
      const runner: ProbeRunner = vi
        .fn()
        .mockResolvedValue({ stdout: '', exitCode: 1 });
      const result = await runProbe(
        { type: 'process_check', process_name: 'SecurityAgent' },
        runner,
      );
      expect(result.status).toBe('FAIL');
    });

    it('returns FAIL when pgrep exits 0 with empty stdout', async () => {
      const runner: ProbeRunner = vi
        .fn()
        .mockResolvedValue({ stdout: '\n', exitCode: 0 });
      const result = await runProbe(
        { type: 'process_check', process_name: 'SecurityAgent' },
        runner,
      );
      expect(result.status).toBe('FAIL');
    });

    it('returns FAIL when runner throws (e.g. pgrep missing)', async () => {
      const runner: ProbeRunner = vi
        .fn()
        .mockRejectedValue(new Error('spawn pgrep ENOENT'));
      const result = await runProbe(
        { type: 'process_check', process_name: 'SecurityAgent' },
        runner,
      );
      expect(result.status).toBe('FAIL');
    });
  });

  describe('defaultProbeRunner', () => {
    it('executes a real shell command and returns stdout/exitCode (exit 0)', async () => {
      const out = await defaultProbeRunner(
        'node -e "process.stdout.write(\'hello\')"',
      );
      expect(out.exitCode).toBe(0);
      expect(out.stdout).toContain('hello');
    });

    it('returns non-zero exitCode when the command fails', async () => {
      const out = await defaultProbeRunner('node -e "process.exit(7)"');
      expect(out.exitCode).toBe(7);
    });
  });
});

describe('runStateProbe', () => {
  let tmpDir: string;
  let db: DatabaseInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-p1-state-probe-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('marks PASS items as completed with completed_at = now (AC-P1-01)', async () => {
    const runner: ProbeRunner = vi.fn(async (cmd: string) => {
      if (cmd === 'brew --version') return { stdout: 'Homebrew 4.3.0', exitCode: 0 };
      if (cmd === 'git config --global user.email')
        return { stdout: 'tao@wrtn.io\n', exitCode: 0 };
      return { stdout: '', exitCode: 1 };
    });

    const fixedNow = 1_700_000_000_000;
    const result = await runStateProbe({
      checklist: FIXTURE_CHECKLIST,
      db,
      runner,
      now: () => fixedNow,
      logger: silentLogger,
    });

    expect(result.itemsCompleted).toEqual(
      expect.arrayContaining(['install-homebrew', 'configure-git']),
    );

    const homebrew = readState(db, 'install-homebrew');
    expect(homebrew?.status).toBe('completed');
    expect(homebrew?.completed_at).toBe(fixedNow);

    const git = readState(db, 'configure-git');
    expect(git?.status).toBe('completed');
    expect(git?.completed_at).toBe(fixedNow);
  });

  it('does not change state for items whose probe FAILS', async () => {
    const runner: ProbeRunner = vi
      .fn()
      .mockResolvedValue({ stdout: '', exitCode: 1 });

    const result = await runStateProbe({
      checklist: FIXTURE_CHECKLIST,
      db,
      runner,
      now: () => 1234,
      logger: silentLogger,
    });

    expect(result.itemsCompleted).toEqual([]);
    expect(readState(db, 'install-homebrew')).toBeUndefined();
    expect(readState(db, 'configure-git')).toBeUndefined();
    expect(readState(db, 'install-security-agent')).toBeUndefined();
  });

  it('skips items without a verification block', async () => {
    const runner = vi
      .fn<ProbeRunner>()
      .mockResolvedValue({ stdout: 'ok', exitCode: 0 });

    await runStateProbe({
      checklist: FIXTURE_CHECKLIST,
      db,
      runner,
      logger: silentLogger,
    });

    expect(readState(db, 'no-verification')).toBeUndefined();
    const calls = (runner.mock.calls as unknown[][]).map((c) => c[0]);
    expect(calls).not.toContain(undefined);
    expect(calls.length).toBe(3); // 3 items have verification
  });

  it('is idempotent: items already completed are not probed again', async () => {
    db.prepare(
      `INSERT INTO item_states (item_id, status, completed_at, attempt_count)
       VALUES ('install-homebrew', 'completed', 999, 1)`,
    ).run();

    const runner = vi
      .fn<ProbeRunner>()
      .mockResolvedValue({ stdout: '', exitCode: 1 });

    const result = await runStateProbe({
      checklist: FIXTURE_CHECKLIST,
      db,
      runner,
      logger: silentLogger,
    });

    expect(result.itemsSkipped).toContain('install-homebrew');
    const calls = (runner.mock.calls as unknown[][]).map((c) => c[0]);
    expect(calls).not.toContain('brew --version');

    const row = readState(db, 'install-homebrew');
    expect(row?.status).toBe('completed');
    expect(row?.completed_at).toBe(999);
  });

  it('returns a summary describing checked / completed / skipped', async () => {
    const runner = vi.fn<ProbeRunner>(async (cmd: string) => {
      if (cmd === 'brew --version') return { stdout: 'ok', exitCode: 0 };
      return { stdout: '', exitCode: 1 };
    });

    const result = await runStateProbe({
      checklist: FIXTURE_CHECKLIST,
      db,
      runner,
      logger: silentLogger,
    });

    expect(result.itemsChecked).toBe(3);
    expect(result.itemsCompleted).toEqual(['install-homebrew']);
    expect(result.itemsSkipped).toEqual([]);
  });

  it('does not depend on consents (runs independently of AI consent)', async () => {
    // No row inserted into `consents` — the probe should still mark items
    // completed when the verification passes.
    const runner = vi
      .fn<ProbeRunner>()
      .mockResolvedValue({ stdout: 'ok', exitCode: 0 });

    const result = await runStateProbe({
      checklist: {
        version: 2,
        schema: 'ai-coaching',
        items: [
          {
            id: 'install-homebrew',
            title: 'Homebrew',
            estimated_minutes: 3,
            verification: { type: 'command', command: 'brew --version' },
          },
        ],
      },
      db,
      runner,
      now: () => 42,
      logger: silentLogger,
    });

    expect(result.itemsCompleted).toEqual(['install-homebrew']);
  });
});

describe('POST /api/state-probe/run', () => {
  let tmpDir: string;
  let db: DatabaseInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-p1-state-probe-route-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('triggers a re-run and reports the summary as JSON', async () => {
    const runner = vi
      .fn<ProbeRunner>()
      .mockResolvedValue({ stdout: 'tao@wrtn.io ok 12345', exitCode: 0 });
    const fixedNow = 1_700_000_000_000;

    const app = createServer({
      logger: silentLogger,
      registerRoutes: (a) => {
        a.use(
          createStateProbeRouter({
            checklist: FIXTURE_CHECKLIST,
            db,
            runner,
            now: () => fixedNow,
            logger: silentLogger,
          }),
        );
      },
    });

    const res = await request(app).post('/api/state-probe/run');
    expect(res.status).toBe(200);
    expect(res.body.itemsChecked).toBe(3);
    expect(res.body.itemsCompleted).toEqual(
      expect.arrayContaining(['install-homebrew', 'configure-git', 'install-security-agent']),
    );

    const homebrew = readState(db, 'install-homebrew');
    expect(homebrew?.status).toBe('completed');
    expect(homebrew?.completed_at).toBe(fixedNow);
  });

  it('subsequent calls do not re-probe already-completed items', async () => {
    const runner = vi
      .fn<ProbeRunner>()
      .mockResolvedValue({ stdout: 'tao@wrtn.io ok 12345', exitCode: 0 });

    const app = createServer({
      logger: silentLogger,
      registerRoutes: (a) => {
        a.use(
          createStateProbeRouter({
            checklist: FIXTURE_CHECKLIST,
            db,
            runner,
            logger: silentLogger,
          }),
        );
      },
    });

    await request(app).post('/api/state-probe/run').expect(200);
    const callsAfterFirst = runner.mock.calls.length;

    const res = await request(app).post('/api/state-probe/run');
    expect(res.status).toBe(200);
    expect(res.body.itemsChecked).toBe(0);
    expect(res.body.itemsSkipped).toEqual(
      expect.arrayContaining(['install-homebrew', 'configure-git', 'install-security-agent']),
    );
    expect(runner.mock.calls.length).toBe(callsAfterFirst); // no new runner invocations
  });
});
