import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  runReset,
  type ResetDeps,
} from '../src/cli/reset.js';
import {
  runStart,
  type StartDeps,
} from '../src/cli/start.js';
import {
  runStop,
  type StopDeps,
} from '../src/cli/stop.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'onboarding-cli-control-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('runStart', () => {
  it('spawns the daemon detached, writes a pidfile, and runs the wizard when first run', async () => {
    const pidPath = join(tmp, 'daemon.pid');
    const spawn = vi.fn(() => ({
      pid: 4242,
      unref: vi.fn(),
    }));
    const wizard = vi.fn(async () => ({ skipped: false }));
    const logs: string[] = [];

    const deps: StartDeps = {
      pidFilePath: pidPath,
      dbFilePath: join(tmp, 'agent.db'),
      spawn: spawn as unknown as StartDeps['spawn'],
      runWizard: wizard,
      isProcessAlive: () => false,
      log: (l) => logs.push(l),
      waitForReady: vi.fn(async () => true),
      env: {},
      now: () => 1700000000000,
    };

    await runStart(deps);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(existsSync(pidPath)).toBe(true);
    expect(readFileSync(pidPath, 'utf-8').trim()).toBe('4242');
    expect(wizard).toHaveBeenCalledTimes(1);
  });

  it('does not start a second daemon when one is already running', async () => {
    const pidPath = join(tmp, 'daemon.pid');
    writeFileSync(pidPath, '5151', 'utf-8');
    const spawn = vi.fn();
    const wizard = vi.fn(async () => ({ skipped: true }));
    const logs: string[] = [];
    const deps: StartDeps = {
      pidFilePath: pidPath,
      dbFilePath: join(tmp, 'agent.db'),
      spawn: spawn as unknown as StartDeps['spawn'],
      runWizard: wizard,
      isProcessAlive: () => true,
      log: (l) => logs.push(l),
      waitForReady: vi.fn(async () => true),
      env: {},
      now: () => 1,
    };
    await runStart(deps);
    expect(spawn).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes('이미') || l.includes('실행'))).toBe(true);
  });

  it('skips wizard when waitForReady fails to connect', async () => {
    const pidPath = join(tmp, 'daemon.pid');
    const spawn = vi.fn(() => ({
      pid: 4242,
      unref: vi.fn(),
    }));
    const wizard = vi.fn(async () => ({ skipped: true }));
    const logs: string[] = [];
    const deps: StartDeps = {
      pidFilePath: pidPath,
      dbFilePath: join(tmp, 'agent.db'),
      spawn: spawn as unknown as StartDeps['spawn'],
      runWizard: wizard,
      isProcessAlive: () => false,
      log: (l) => logs.push(l),
      waitForReady: vi.fn(async () => false),
      env: {},
      now: () => 1,
    };
    await runStart(deps);
    expect(wizard).not.toHaveBeenCalled();
    expect(logs.some((l) => /시작|기동|실패/.test(l))).toBe(true);
  });

  it('replaces a stale pidfile when the recorded process is no longer alive', async () => {
    const pidPath = join(tmp, 'daemon.pid');
    writeFileSync(pidPath, '99999', 'utf-8');
    const spawn = vi.fn(() => ({ pid: 1234, unref: vi.fn() }));
    const wizard = vi.fn(async () => ({ skipped: false }));
    const deps: StartDeps = {
      pidFilePath: pidPath,
      dbFilePath: join(tmp, 'agent.db'),
      spawn: spawn as unknown as StartDeps['spawn'],
      runWizard: wizard,
      isProcessAlive: () => false,
      log: () => undefined,
      waitForReady: vi.fn(async () => true),
      env: {},
      now: () => 1,
    };
    await runStart(deps);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(readFileSync(pidPath, 'utf-8').trim()).toBe('1234');
  });

  it('reports "이미 완료" when the wizard reports skipped after start', async () => {
    const pidPath = join(tmp, 'daemon.pid');
    const spawn = vi.fn(() => ({ pid: 1234, unref: vi.fn() }));
    const wizard = vi.fn(async () => ({ skipped: true }));
    const logs: string[] = [];
    const deps: StartDeps = {
      pidFilePath: pidPath,
      dbFilePath: join(tmp, 'agent.db'),
      spawn: spawn as unknown as StartDeps['spawn'],
      runWizard: wizard,
      isProcessAlive: () => false,
      log: (l) => logs.push(l),
      waitForReady: vi.fn(async () => true),
      env: {},
      now: () => 1,
    };
    await runStart(deps);
    expect(wizard).toHaveBeenCalledTimes(1);
    expect(logs.some((l) => l.includes('위저드'))).toBe(true);
  });
});

describe('runStop', () => {
  it('reads the pidfile, sends SIGTERM, and removes the pidfile', async () => {
    const pidPath = join(tmp, 'daemon.pid');
    writeFileSync(pidPath, '7777', 'utf-8');
    const kill = vi.fn();
    const logs: string[] = [];
    const deps: StopDeps = {
      pidFilePath: pidPath,
      kill: kill as unknown as StopDeps['kill'],
      isProcessAlive: () => true,
      log: (l) => logs.push(l),
    };
    const result = await runStop(deps);
    expect(result.stopped).toBe(true);
    expect(kill).toHaveBeenCalledWith(7777, 'SIGTERM');
    expect(existsSync(pidPath)).toBe(false);
  });

  it('reports "데몬이 실행 중이지 않음" when no pidfile exists', async () => {
    const pidPath = join(tmp, 'daemon.pid');
    const kill = vi.fn();
    const logs: string[] = [];
    const deps: StopDeps = {
      pidFilePath: pidPath,
      kill: kill as unknown as StopDeps['kill'],
      isProcessAlive: () => false,
      log: (l) => logs.push(l),
    };
    const result = await runStop(deps);
    expect(result.stopped).toBe(false);
    expect(kill).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes('실행 중이지 않'))).toBe(true);
  });

  it('reports "데몬이 실행 중이지 않음" when pidfile exists but the process is dead', async () => {
    const pidPath = join(tmp, 'daemon.pid');
    writeFileSync(pidPath, '99999', 'utf-8');
    const kill = vi.fn();
    const logs: string[] = [];
    const deps: StopDeps = {
      pidFilePath: pidPath,
      kill: kill as unknown as StopDeps['kill'],
      isProcessAlive: () => false,
      log: (l) => logs.push(l),
    };
    const result = await runStop(deps);
    expect(result.stopped).toBe(false);
    expect(kill).not.toHaveBeenCalled();
    expect(existsSync(pidPath)).toBe(false);
    expect(logs.some((l) => l.includes('실행 중이지 않'))).toBe(true);
  });

  it('removes the pidfile and reports not-running when contents are not a valid number', async () => {
    const pidPath = join(tmp, 'daemon.pid');
    writeFileSync(pidPath, 'not-a-number', 'utf-8');
    const kill = vi.fn();
    const logs: string[] = [];
    const deps: StopDeps = {
      pidFilePath: pidPath,
      kill: kill as unknown as StopDeps['kill'],
      isProcessAlive: () => true,
      log: (l) => logs.push(l),
    };
    const result = await runStop(deps);
    expect(result.stopped).toBe(false);
    expect(kill).not.toHaveBeenCalled();
    expect(existsSync(pidPath)).toBe(false);
  });
});

describe('runReset', () => {
  it('requires confirm prompt when --yes is not set', async () => {
    const dbPath = join(tmp, 'agent.db');
    writeFileSync(dbPath, 'fake', 'utf-8');
    const promptConfirm = vi.fn(async () => false);
    const logs: string[] = [];
    const deps: ResetDeps = {
      dbFilePath: dbPath,
      yes: false,
      promptConfirm:
        promptConfirm as unknown as ResetDeps['promptConfirm'],
      log: (l) => logs.push(l),
    };
    const result = await runReset(deps);
    expect(result.deleted).toBe(false);
    expect(promptConfirm).toHaveBeenCalledTimes(1);
    expect(existsSync(dbPath)).toBe(true);
  });

  it('deletes the SQLite file when confirmed', async () => {
    const dbPath = join(tmp, 'agent.db');
    writeFileSync(dbPath, 'fake', 'utf-8');
    const promptConfirm = vi.fn(async () => true);
    const logs: string[] = [];
    const deps: ResetDeps = {
      dbFilePath: dbPath,
      yes: false,
      promptConfirm:
        promptConfirm as unknown as ResetDeps['promptConfirm'],
      log: (l) => logs.push(l),
    };
    const result = await runReset(deps);
    expect(result.deleted).toBe(true);
    expect(existsSync(dbPath)).toBe(false);
  });

  it('skips the prompt when --yes flag is set', async () => {
    const dbPath = join(tmp, 'agent.db');
    writeFileSync(dbPath, 'fake', 'utf-8');
    const promptConfirm = vi.fn(async () => false);
    const logs: string[] = [];
    const deps: ResetDeps = {
      dbFilePath: dbPath,
      yes: true,
      promptConfirm:
        promptConfirm as unknown as ResetDeps['promptConfirm'],
      log: (l) => logs.push(l),
    };
    const result = await runReset(deps);
    expect(result.deleted).toBe(true);
    expect(promptConfirm).not.toHaveBeenCalled();
    expect(existsSync(dbPath)).toBe(false);
  });

  it('reports a friendly message when there is no database to delete', async () => {
    const dbPath = join(tmp, 'agent.db');
    const promptConfirm = vi.fn(async () => true);
    const logs: string[] = [];
    const deps: ResetDeps = {
      dbFilePath: dbPath,
      yes: true,
      promptConfirm:
        promptConfirm as unknown as ResetDeps['promptConfirm'],
      log: (l) => logs.push(l),
    };
    const result = await runReset(deps);
    expect(result.deleted).toBe(false);
    expect(logs.some((l) => /이미|없|초기/.test(l))).toBe(true);
  });
});
