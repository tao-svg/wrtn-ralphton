import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { runWizard, type WizardDeps } from '../src/cli/wizard.js';
import { openDatabase, type DatabaseInstance } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';

interface ProfileRow {
  employee_id: string;
  email: string;
  name: string;
  created_at: number;
}

function createTempDb(): { db: DatabaseInstance; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'onboarding-cli-wizard-'));
  const db = openDatabase(join(dir, 'agent.db'));
  migrate(db);
  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function makeFetchStub(): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/api/consents')) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200 });
  });
}

function makeBaseDeps(
  overrides: Partial<WizardDeps> & { db: DatabaseInstance },
): WizardDeps & { fetchStub: ReturnType<typeof vi.fn>; logs: string[] } {
  const logs: string[] = [];
  const fetchStub =
    (overrides.fetch as ReturnType<typeof vi.fn> | undefined) ?? makeFetchStub();
  return {
    fetchStub,
    logs,
    baseUrl: 'http://localhost:7777',
    fetch: fetchStub as unknown as typeof fetch,
    log: (line: string) => logs.push(line),
    promptInput: vi.fn(async ({ message }: { message: string }) => {
      if (message.includes('이름')) return '김하나';
      if (message.includes('이메일')) return 'hana@wrtn.io';
      if (message.includes('직무')) return 'Frontend';
      if (message.includes('전화')) return '010-1234-5678';
      if (message.includes('사번') || message.includes('Employee')) return 'E0001';
      return '';
    }) as unknown as WizardDeps['promptInput'],
    promptConfirm: vi.fn(async () => true) as unknown as WizardDeps['promptConfirm'],
    promptPress: vi.fn(async () => undefined) as unknown as WizardDeps['promptPress'],
    launchSystemPanel: vi.fn(async () => undefined) as unknown as WizardDeps['launchSystemPanel'],
    platform: 'darwin',
    now: () => 1700000000000,
    ...overrides,
  };
}

describe('runWizard — first run', () => {
  it('inserts the user profile, posts anthropic consent, and shows screen-recording guide', async () => {
    const { db, cleanup } = createTempDb();
    try {
      const deps = makeBaseDeps({ db });
      const result = await runWizard(deps);
      expect(result.skipped).toBe(false);

      const profile = db
        .prepare('SELECT employee_id, email, name, created_at FROM profile')
        .get() as ProfileRow | undefined;
      expect(profile).toBeDefined();
      expect(profile?.email).toBe('hana@wrtn.io');
      expect(profile?.name).toBe('김하나');

      const consentCalls = deps.fetchStub.mock.calls.filter((c) =>
        String(c[0]).endsWith('/api/consents'),
      );
      expect(consentCalls.length).toBeGreaterThanOrEqual(1);
      const last = consentCalls.at(-1)!;
      const init = last[1] as RequestInit;
      expect(init.method).toBe('POST');
      const body = JSON.parse(String(init.body));
      expect(body).toEqual({
        consent_type: 'anthropic_transmission',
        granted: true,
      });

      expect(deps.launchSystemPanel).toHaveBeenCalledTimes(1);
      const url = (deps.launchSystemPanel as ReturnType<typeof vi.fn>).mock
        .calls[0]![0];
      expect(String(url)).toContain('Privacy_ScreenCapture');
    } finally {
      cleanup();
    }
  });

  it('does not POST consent when user denies anthropic transmission', async () => {
    const { db, cleanup } = createTempDb();
    try {
      const promptConfirm = vi.fn(async ({ message }: { message: string }) => {
        if (message.includes('Anthropic')) return false;
        return true;
      });
      const deps = makeBaseDeps({
        db,
        promptConfirm: promptConfirm as unknown as WizardDeps['promptConfirm'],
      });
      const result = await runWizard(deps);
      expect(result.skipped).toBe(false);
      const consentCalls = deps.fetchStub.mock.calls.filter((c) =>
        String(c[0]).endsWith('/api/consents'),
      );
      const granted = consentCalls.map((c) => {
        const init = c[1] as RequestInit;
        return JSON.parse(String(init.body));
      });
      expect(granted.some((g) => g.granted === true)).toBe(false);
    } finally {
      cleanup();
    }
  });
});

describe('runWizard — repeat run skip', () => {
  it('returns skipped=true when profile already exists (AC-CORE-02)', async () => {
    const { db, cleanup } = createTempDb();
    try {
      db.prepare(
        'INSERT INTO profile (employee_id, email, name, created_at) VALUES (?, ?, ?, ?)',
      ).run('E0001', 'hana@wrtn.io', '김하나', 1);
      const deps = makeBaseDeps({ db });
      const result = await runWizard(deps);
      expect(result.skipped).toBe(true);
      expect(deps.promptInput).not.toHaveBeenCalled();
      expect(deps.fetchStub).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });
});

describe('runWizard — non-darwin', () => {
  it('skips launching the system panel and prints a notice on linux', async () => {
    const { db, cleanup } = createTempDb();
    try {
      const launchSystemPanel = vi.fn(async () => undefined);
      const deps = makeBaseDeps({
        db,
        platform: 'linux',
        launchSystemPanel:
          launchSystemPanel as unknown as WizardDeps['launchSystemPanel'],
      });
      const result = await runWizard(deps);
      expect(result.skipped).toBe(false);
      expect(launchSystemPanel).not.toHaveBeenCalled();
      expect(deps.logs.some((l) => /macOS/.test(l))).toBe(true);
    } finally {
      cleanup();
    }
  });
});

describe('runWizard — error handling', () => {
  it('logs but does not abort when the system-panel launch fails', async () => {
    const { db, cleanup } = createTempDb();
    try {
      const launchSystemPanel = vi.fn(async () => {
        throw new Error('open exited 1');
      });
      const deps = makeBaseDeps({
        db,
        launchSystemPanel:
          launchSystemPanel as unknown as WizardDeps['launchSystemPanel'],
      });
      const result = await runWizard(deps);
      expect(result.skipped).toBe(false);
      expect(launchSystemPanel).toHaveBeenCalledTimes(1);
      expect(deps.logs.some((l) => l.includes('자동으로 열지 못했습니다'))).toBe(
        true,
      );
    } finally {
      cleanup();
    }
  });

  it('throws when the consents endpoint returns non-2xx', async () => {
    const { db, cleanup } = createTempDb();
    try {
      const fetchStub = vi.fn(async () =>
        new Response('boom', { status: 500 }),
      );
      const deps = makeBaseDeps({
        db,
        fetch: fetchStub as unknown as typeof fetch,
      });
      await expect(runWizard(deps)).rejects.toThrow(/consent_post_failed/);
    } finally {
      cleanup();
    }
  });
});
