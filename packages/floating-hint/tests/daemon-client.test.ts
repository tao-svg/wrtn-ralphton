import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_DAEMON_BASE_URL,
  DaemonHttpError,
  createDaemonClient,
} from '../src/main/daemon-client.js';

interface RecordedCall {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function makeFetch(
  response: { status?: number; body?: unknown } = {},
): { fetchImpl: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const status = response.status ?? 200;
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = init.headers as Record<string, string>;
      for (const k of Object.keys(h)) headers[k] = h[k]!;
    }
    calls.push({
      url: url.toString(),
      method: init?.method,
      headers,
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response.body ?? {},
    } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('DEFAULT_DAEMON_BASE_URL', () => {
  it('is http://localhost:7777 (PRD §9.1)', () => {
    expect(DEFAULT_DAEMON_BASE_URL).toBe('http://localhost:7777');
  });
});

describe('createDaemonClient', () => {
  it('GETs /api/checklist on getChecklist()', async () => {
    const { fetchImpl, calls } = makeFetch({ body: { items: [] } });
    const client = createDaemonClient({ fetchImpl });
    const result = await client.getChecklist();
    expect(result).toEqual({ items: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('http://localhost:7777/api/checklist');
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.body).toBeUndefined();
  });

  it('POSTs /api/items/:itemId/start with URL-encoded itemId', async () => {
    const { fetchImpl, calls } = makeFetch({ body: { ok: true } });
    const client = createDaemonClient({ fetchImpl });
    await client.startItem('install/homebrew');
    expect(calls[0]!.url).toBe(
      'http://localhost:7777/api/items/install%2Fhomebrew/start',
    );
    expect(calls[0]!.method).toBe('POST');
  });

  it('POSTs /api/vision/guide with JSON body', async () => {
    const { fetchImpl, calls } = makeFetch({ body: { call_id: 'vc_1' } });
    const client = createDaemonClient({ fetchImpl });
    await client.requestGuide({ item_id: 'a', step_id: 'b' });
    expect(calls[0]!.url).toBe('http://localhost:7777/api/vision/guide');
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.headers?.['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ item_id: 'a', step_id: 'b' });
  });

  it('POSTs /api/vision/verify with JSON body', async () => {
    const { fetchImpl, calls } = makeFetch({ body: { call_id: 'vc_2' } });
    const client = createDaemonClient({ fetchImpl });
    await client.requestVerify({ item_id: 'a', step_id: 'b' });
    expect(calls[0]!.url).toBe('http://localhost:7777/api/vision/verify');
    expect(calls[0]!.method).toBe('POST');
  });

  it('GETs /api/vision/rate-limit', async () => {
    const { fetchImpl, calls } = makeFetch({
      body: { state: 'normal', current_hour_calls: 0 },
    });
    const client = createDaemonClient({ fetchImpl });
    const out = await client.getRateLimit();
    expect(out).toEqual({ state: 'normal', current_hour_calls: 0 });
    expect(calls[0]!.url).toBe('http://localhost:7777/api/vision/rate-limit');
    expect(calls[0]!.method).toBe('GET');
  });

  it('GETs and POSTs /api/consents', async () => {
    const { fetchImpl, calls } = makeFetch({ body: {} });
    const client = createDaemonClient({ fetchImpl });
    await client.getConsents();
    await client.postConsent({ consent_type: 'anthropic_transmission', granted: true });
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.url).toBe('http://localhost:7777/api/consents');
    expect(calls[1]!.method).toBe('POST');
    expect(calls[1]!.url).toBe('http://localhost:7777/api/consents');
    expect(JSON.parse(calls[1]!.body!)).toEqual({
      consent_type: 'anthropic_transmission',
      granted: true,
    });
  });

  it('POSTs /api/clipboard with command body', async () => {
    const { fetchImpl, calls } = makeFetch({ body: { ok: true } });
    const client = createDaemonClient({ fetchImpl });
    await client.postClipboard({ command: 'brew --version' });
    expect(calls[0]!.url).toBe('http://localhost:7777/api/clipboard');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ command: 'brew --version' });
  });

  it('POSTs /api/verify/run with verification payload', async () => {
    const { fetchImpl, calls } = makeFetch({
      body: { status: 'pass', details: '' },
    });
    const client = createDaemonClient({ fetchImpl });
    await client.runVerify({ item_id: 'a', verification: { type: 'noop' } });
    expect(calls[0]!.url).toBe('http://localhost:7777/api/verify/run');
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      item_id: 'a',
      verification: { type: 'noop' },
    });
  });

  it('honours a custom baseUrl', async () => {
    const { fetchImpl, calls } = makeFetch({ body: {} });
    const client = createDaemonClient({
      baseUrl: 'http://127.0.0.1:9999',
      fetchImpl,
    });
    await client.getChecklist();
    expect(calls[0]!.url).toBe('http://127.0.0.1:9999/api/checklist');
  });

  it('throws DaemonHttpError on a non-2xx response, exposing status and body', async () => {
    const { fetchImpl } = makeFetch({
      status: 503,
      body: { error: 'vision_api_timeout' },
    });
    const client = createDaemonClient({ fetchImpl });
    await expect(
      client.requestGuide({ item_id: 'x', step_id: 'y' }),
    ).rejects.toBeInstanceOf(DaemonHttpError);
    try {
      await client.requestGuide({ item_id: 'x', step_id: 'y' });
    } catch (err) {
      const e = err as DaemonHttpError;
      expect(e.status).toBe(503);
      expect(e.body).toEqual({ error: 'vision_api_timeout' });
      expect(e.message).toMatch(/503/);
    }
  });

  it('still rejects with DaemonHttpError when the error body is not valid JSON', async () => {
    const fetchImpl = (async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    })) as unknown as typeof fetch;
    const client = createDaemonClient({ fetchImpl });
    await expect(client.getChecklist()).rejects.toBeInstanceOf(DaemonHttpError);
  });

  it('falls back to global fetch when no fetchImpl is provided', async () => {
    const original = globalThis.fetch;
    const stub = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    })) as unknown as typeof fetch;
    globalThis.fetch = stub;
    try {
      const client = createDaemonClient();
      await client.getChecklist();
      expect(stub).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
