import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/renderer/state/store.js';
import type { RendererApi } from '../src/renderer/state/store.js';

function makeContext() {
  return {
    type: 'SET_CONTEXT' as const,
    context: { itemId: 'i', stepId: 's', stepIndex: 0, totalSteps: 1 },
    stepIds: ['s'],
  };
}

function baseApi(over: Partial<RendererApi> = {}): RendererApi {
  return {
    getChecklist: vi.fn().mockResolvedValue({ items: [] }),
    requestGuide: vi.fn(),
    requestVerify: vi.fn(),
    getRateLimit: vi.fn().mockResolvedValue({ state: 'normal' }),
    getConsents: vi.fn().mockResolvedValue({}),
    ...over,
  };
}

describe('createStore — overlay integration', () => {
  it('calls overlay.show(region) when guide returns with highlight_region', async () => {
    const overlay = { show: vi.fn(), hide: vi.fn() };
    const api = baseApi({
      requestGuide: vi.fn().mockResolvedValue({
        call_id: 'vc',
        result: {
          type: 'guide',
          message: 'click the icon',
          highlight_region: { x: 24, y: 480, width: 32, height: 32 },
          confidence: 'high',
        },
      }),
    });
    const store = createStore({ api, overlay });
    store.dispatch(makeContext());
    await store.requestGuide();
    expect(overlay.show).toHaveBeenCalledTimes(1);
    expect(overlay.show).toHaveBeenCalledWith({
      x: 24,
      y: 480,
      width: 32,
      height: 32,
    });
    expect(overlay.hide).not.toHaveBeenCalled();
  });

  it('calls overlay.hide when guide returns without highlight_region', async () => {
    const overlay = { show: vi.fn(), hide: vi.fn() };
    const api = baseApi({
      requestGuide: vi.fn().mockResolvedValue({
        call_id: 'vc',
        result: {
          type: 'guide',
          message: 'no specific spot',
          confidence: 'medium',
        },
      }),
    });
    const store = createStore({ api, overlay });
    store.dispatch(makeContext());
    await store.requestGuide();
    expect(overlay.show).not.toHaveBeenCalled();
    expect(overlay.hide).toHaveBeenCalledTimes(1);
  });

  it('hides the overlay before issuing a verify request', async () => {
    const overlay = { show: vi.fn(), hide: vi.fn() };
    const api = baseApi({
      requestVerify: vi.fn().mockResolvedValue({
        call_id: 'vc',
        result: { type: 'verify', status: 'fail', reasoning: 'not yet' },
      }),
    });
    const store = createStore({ api, overlay });
    store.dispatch(makeContext());
    await store.requestVerify();
    expect(overlay.hide).toHaveBeenCalled();
  });

  it('hides the overlay when guide errors out', async () => {
    const overlay = { show: vi.fn(), hide: vi.fn() };
    const err = Object.assign(new Error('boom'), {
      name: 'DaemonHttpError',
      status: 503,
      body: { error: 'vision_api_timeout' },
    });
    const api = baseApi({
      requestGuide: vi.fn().mockRejectedValue(err),
    });
    const store = createStore({ api, overlay });
    store.dispatch(makeContext());
    await store.requestGuide();
    expect(overlay.show).not.toHaveBeenCalled();
    expect(overlay.hide).toHaveBeenCalled();
  });

  it('works without an overlay client (overlay is optional)', async () => {
    const api = baseApi({
      requestGuide: vi.fn().mockResolvedValue({
        call_id: 'vc',
        result: {
          type: 'guide',
          message: 'click',
          highlight_region: { x: 1, y: 2, width: 3, height: 4 },
          confidence: 'high',
        },
      }),
    });
    const store = createStore({ api });
    store.dispatch(makeContext());
    await expect(store.requestGuide()).resolves.toBeUndefined();
    expect(store.getState().mode.kind).toBe('showing-guide');
  });

  it('hides the overlay when retry leaves error state and re-enters guide flow', async () => {
    const overlay = { show: vi.fn(), hide: vi.fn() };
    const requestGuide = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('boom'), {
          name: 'DaemonHttpError',
          status: 503,
          body: { error: 'vision_api_timeout' },
        }),
      )
      .mockResolvedValueOnce({
        call_id: 'vc',
        result: {
          type: 'guide',
          message: 'now click here',
          highlight_region: { x: 5, y: 6, width: 7, height: 8 },
          confidence: 'high',
        },
      });
    const store = createStore({ api: baseApi({ requestGuide }), overlay });
    store.dispatch(makeContext());
    await store.requestGuide();
    expect(overlay.hide).toHaveBeenCalledTimes(1);
    overlay.hide.mockClear();
    overlay.show.mockClear();
    await store.retry();
    expect(overlay.show).toHaveBeenCalledWith({
      x: 5,
      y: 6,
      width: 7,
      height: 8,
    });
  });
});
