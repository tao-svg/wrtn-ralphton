import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRendererApi } from '../src/renderer/api.js';

interface DaemonBridge {
  getChecklist: ReturnType<typeof vi.fn>;
  startItem: ReturnType<typeof vi.fn>;
  requestGuide: ReturnType<typeof vi.fn>;
  requestVerify: ReturnType<typeof vi.fn>;
  getRateLimit: ReturnType<typeof vi.fn>;
  getConsents: ReturnType<typeof vi.fn>;
  postConsent: ReturnType<typeof vi.fn>;
  postClipboard: ReturnType<typeof vi.fn>;
  runVerify: ReturnType<typeof vi.fn>;
}

function makeBridge(): DaemonBridge {
  return {
    getChecklist: vi.fn().mockResolvedValue({ items: [] }),
    startItem: vi.fn().mockResolvedValue({ ok: true }),
    requestGuide: vi.fn().mockResolvedValue({
      call_id: 'vc',
      cached: false,
      latency_ms: 1,
      result: { type: 'guide', message: 'm', confidence: 'high' },
    }),
    requestVerify: vi.fn().mockResolvedValue({
      call_id: 'vc',
      result: { type: 'verify', status: 'pass', reasoning: 'ok' },
    }),
    getRateLimit: vi.fn().mockResolvedValue({ state: 'normal' }),
    getConsents: vi.fn().mockResolvedValue({}),
    postConsent: vi.fn().mockResolvedValue({}),
    postClipboard: vi.fn().mockResolvedValue({}),
    runVerify: vi.fn().mockResolvedValue({}),
  };
}

const original = (globalThis as { daemonClient?: unknown }).daemonClient;

beforeEach(() => {
  (globalThis as { daemonClient?: unknown }).daemonClient = undefined;
});

afterEach(() => {
  (globalThis as { daemonClient?: unknown }).daemonClient = original;
});

describe('createRendererApi', () => {
  it('proxies getChecklist() to the global daemonClient bridge', async () => {
    const bridge = makeBridge();
    (globalThis as { daemonClient?: DaemonBridge }).daemonClient = bridge;
    const api = createRendererApi();
    await api.getChecklist();
    expect(bridge.getChecklist).toHaveBeenCalledTimes(1);
  });

  it('proxies requestGuide(input) preserving the input shape', async () => {
    const bridge = makeBridge();
    (globalThis as { daemonClient?: DaemonBridge }).daemonClient = bridge;
    const api = createRendererApi();
    await api.requestGuide({ item_id: 'a', step_id: 'b' });
    expect(bridge.requestGuide).toHaveBeenCalledWith({
      item_id: 'a',
      step_id: 'b',
    });
  });

  it('proxies requestVerify(input)', async () => {
    const bridge = makeBridge();
    (globalThis as { daemonClient?: DaemonBridge }).daemonClient = bridge;
    const api = createRendererApi();
    await api.requestVerify({ item_id: 'a', step_id: 'b' });
    expect(bridge.requestVerify).toHaveBeenCalledWith({
      item_id: 'a',
      step_id: 'b',
    });
  });

  it('proxies getRateLimit()', async () => {
    const bridge = makeBridge();
    (globalThis as { daemonClient?: DaemonBridge }).daemonClient = bridge;
    const api = createRendererApi();
    const out = await api.getRateLimit();
    expect(out).toEqual({ state: 'normal' });
  });

  it('proxies getConsents()', async () => {
    const bridge = makeBridge();
    (globalThis as { daemonClient?: DaemonBridge }).daemonClient = bridge;
    const api = createRendererApi();
    await api.getConsents();
    expect(bridge.getConsents).toHaveBeenCalled();
  });

  it('throws when window.daemonClient is missing', () => {
    expect(() => createRendererApi()).toThrowError(/daemonClient/);
  });

  it('accepts an explicit bridge override (no global needed)', async () => {
    const bridge = makeBridge();
    const api = createRendererApi({ bridge });
    await api.getChecklist();
    expect(bridge.getChecklist).toHaveBeenCalled();
  });
});
