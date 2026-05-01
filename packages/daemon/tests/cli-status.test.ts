import { describe, expect, it, vi } from 'vitest';

import {
  fetchDaemonStatus,
  renderStatus,
  runStatus,
  type DaemonStatusSnapshot,
} from '../src/cli/status.js';

function makeFetchStub(responses: Record<string, unknown>): typeof fetch {
  return vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [match, body] of Object.entries(responses)) {
      if (url.endsWith(match)) {
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  }) as unknown as typeof fetch;
}

const SAMPLE_RESPONSES = {
  '/api/checklist': {
    items: [
      {
        item_id: 'install-homebrew',
        title: 'Homebrew 설치',
        status: 'completed',
        current_step: null,
        started_at: 1,
        completed_at: 2,
        attempt_count: 1,
      },
      {
        item_id: 'configure-git',
        title: 'Git 글로벌 설정',
        status: 'pending',
        current_step: null,
        started_at: null,
        completed_at: null,
        attempt_count: 0,
      },
    ],
  },
  '/api/consents': {
    screen_recording: {
      consent_type: 'screen_recording',
      granted: true,
      granted_at: 1,
      revoked_at: null,
    },
    anthropic_transmission: {
      consent_type: 'anthropic_transmission',
      granted: false,
      granted_at: null,
      revoked_at: null,
    },
  },
  '/api/vision/rate-limit': {
    current_hour_calls: 12,
    state: 'ok',
    reset_at: 1700000000000,
  },
};

describe('fetchDaemonStatus', () => {
  it('calls the three daemon endpoints with the given baseUrl', async () => {
    const stub = makeFetchStub(SAMPLE_RESPONSES);
    const snapshot = await fetchDaemonStatus({
      baseUrl: 'http://localhost:7777',
      fetch: stub,
    });
    expect(stub).toHaveBeenCalledTimes(3);
    const calls = (stub as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => String(c[0]),
    );
    expect(calls).toContain('http://localhost:7777/api/checklist');
    expect(calls).toContain('http://localhost:7777/api/consents');
    expect(calls).toContain('http://localhost:7777/api/vision/rate-limit');
    expect(snapshot.checklist.items).toHaveLength(2);
    expect(snapshot.consents.anthropic_transmission.granted).toBe(false);
    expect(snapshot.rateLimit.state).toBe('ok');
  });

  it('falls back to the default base URL (localhost:7777) when none is provided', async () => {
    const stub = makeFetchStub(SAMPLE_RESPONSES);
    await fetchDaemonStatus({ fetch: stub });
    const calls = (stub as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => String(c[0]),
    );
    expect(calls.every((u) => u.startsWith('http://localhost:7777/'))).toBe(true);
  });

  it('throws DaemonUnreachableError when fetch rejects (daemon not running)', async () => {
    const stub = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    await expect(
      fetchDaemonStatus({ fetch: stub, baseUrl: 'http://localhost:7777' }),
    ).rejects.toMatchObject({ code: 'daemon_unreachable' });
  });

  it('throws when an endpoint returns non-2xx', async () => {
    const stub = vi.fn(async () =>
      new Response('boom', { status: 500 }),
    ) as unknown as typeof fetch;
    await expect(
      fetchDaemonStatus({ fetch: stub, baseUrl: 'http://localhost:7777' }),
    ).rejects.toThrow();
  });
});

describe('renderStatus', () => {
  const snapshot: DaemonStatusSnapshot = {
    checklist: SAMPLE_RESPONSES['/api/checklist'] as DaemonStatusSnapshot['checklist'],
    consents: SAMPLE_RESPONSES['/api/consents'] as DaemonStatusSnapshot['consents'],
    rateLimit: SAMPLE_RESPONSES['/api/vision/rate-limit'] as DaemonStatusSnapshot['rateLimit'],
  };

  it('renders Korean output with item titles, consent state and rate limit', () => {
    const lines: string[] = [];
    renderStatus(snapshot, (line) => lines.push(line));
    const all = lines.join('\n');
    expect(all).toContain('체크리스트');
    expect(all).toContain('Homebrew 설치');
    expect(all).toContain('Git 글로벌 설정');
    expect(all).toContain('동의');
    expect(all).toContain('Anthropic');
    expect(all).toContain('Vision');
    expect(all).toContain('12');
  });

  it('marks completed items distinctly from pending ones', () => {
    const lines: string[] = [];
    renderStatus(snapshot, (line) => lines.push(line));
    const homebrewLine = lines.find((l) => l.includes('Homebrew 설치'));
    const gitLine = lines.find((l) => l.includes('Git 글로벌 설정'));
    expect(homebrewLine).toBeDefined();
    expect(gitLine).toBeDefined();
    expect(homebrewLine).not.toEqual(gitLine);
  });

  it('shows Anthropic 동의 미부여 when not granted', () => {
    const lines: string[] = [];
    renderStatus(snapshot, (line) => lines.push(line));
    const consentLine = lines.find((l) => l.includes('Anthropic'));
    expect(consentLine).toMatch(/미부여|미동의/);
  });
});

describe('runStatus', () => {
  it('orchestrates fetch + render and returns the snapshot', async () => {
    const stub = makeFetchStub(SAMPLE_RESPONSES);
    const lines: string[] = [];
    const result = await runStatus({
      baseUrl: 'http://localhost:7777',
      fetch: stub,
      log: (l) => lines.push(l),
    });
    expect(result.checklist.items).toHaveLength(2);
    expect(lines.join('\n')).toContain('Homebrew 설치');
  });

  it('logs a friendly daemon-unreachable message and rethrows', async () => {
    const stub = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const lines: string[] = [];
    await expect(
      runStatus({
        baseUrl: 'http://localhost:7777',
        fetch: stub,
        log: (l) => lines.push(l),
      }),
    ).rejects.toMatchObject({ code: 'daemon_unreachable' });
    expect(lines.join('\n')).toMatch(/데몬|실행/);
  });
});
