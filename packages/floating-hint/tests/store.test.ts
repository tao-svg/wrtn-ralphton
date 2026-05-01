import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/renderer/state/store.js';
import type { AppState } from '../src/renderer/state/machine.js';

describe('createStore', () => {
  it('exposes initial state via getState()', () => {
    const store = createStore();
    const s = store.getState();
    expect(s.mode).toEqual({ kind: 'idle' });
    expect(s.context.itemId).toBeNull();
  });

  it('notifies subscribers on dispatch', () => {
    const store = createStore();
    const seen: AppState[] = [];
    const unsub = store.subscribe((s) => seen.push(s));
    store.dispatch({
      type: 'SET_CONTEXT',
      context: { itemId: 'a', stepId: 'b', stepIndex: 0, totalSteps: 1 },
      stepIds: ['b'],
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.context.itemId).toBe('a');
    unsub();
    store.dispatch({ type: 'REQUEST_GUIDE' });
    expect(seen).toHaveLength(1);
  });

  it('does not notify subscribers when state is unchanged', () => {
    const store = createStore();
    const sub = vi.fn();
    store.subscribe(sub);
    store.dispatch({ type: 'RETRY' });
    expect(sub).not.toHaveBeenCalled();
  });

  it('multiple subscribers each receive updates independently', () => {
    const store = createStore();
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    const unsubB = store.subscribe(b);
    store.dispatch({
      type: 'SET_CONSENTS',
      consents: { screen_recording: true, anthropic_transmission: true },
    });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubB();
    store.dispatch({
      type: 'SET_RATE_LIMIT',
      rateLimit: { state: 'normal' },
    });
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('startChecklistPoll fetches /api/checklist every interval', async () => {
    vi.useFakeTimers();
    try {
      const items = [
        {
          id: 'install',
          title: 't',
          estimated_minutes: 1,
          ai_coaching: {
            overall_goal: 'g',
            steps: [
              { id: 's0', intent: 'i0', success_criteria: 'sc0' },
              { id: 's1', intent: 'i1', success_criteria: 'sc1' },
            ],
          },
        },
      ];
      const getChecklist = vi.fn().mockResolvedValue({
        items: items.map((i) => ({
          item_id: i.id,
          title: i.title,
          status: 'in_progress',
          current_step: 's0',
          started_at: 1,
          completed_at: null,
          attempt_count: 0,
        })),
      });
      const store = createStore({
        api: {
          getChecklist,
          requestGuide: vi.fn(),
          requestVerify: vi.fn(),
          getRateLimit: vi.fn().mockResolvedValue({ state: 'normal' }),
          getConsents: vi.fn().mockResolvedValue({}),
        },
        checklist: items,
        pollIntervalMs: 5_000,
      });
      store.startChecklistPoll();
      await vi.advanceTimersByTimeAsync(0); // initial tick
      expect(getChecklist).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(getChecklist).toHaveBeenCalledTimes(2);
      // Resulting state reflects current item/step pulled from checklist + state
      const s = store.getState();
      expect(s.context.itemId).toBe('install');
      expect(s.context.stepId).toBe('s0');
      expect(s.context.stepIndex).toBe(0);
      expect(s.context.totalSteps).toBe(2);
      expect(s.stepIds).toEqual(['s0', 's1']);
      store.stopChecklistPoll();
    } finally {
      vi.useRealTimers();
    }
  });

  it('requestGuide() dispatches REQUEST_GUIDE then GUIDE_SUCCESS on 200', async () => {
    const requestGuide = vi.fn().mockResolvedValue({
      call_id: 'vc_1',
      cached: false,
      latency_ms: 100,
      result: { type: 'guide', message: 'click', confidence: 'high' },
    });
    const store = createStore({
      api: {
        getChecklist: vi.fn(),
        requestGuide,
        requestVerify: vi.fn(),
        getRateLimit: vi.fn(),
        getConsents: vi.fn(),
      },
    });
    store.dispatch({
      type: 'SET_CONTEXT',
      context: { itemId: 'i', stepId: 's', stepIndex: 0, totalSteps: 1 },
      stepIds: ['s'],
    });
    await store.requestGuide();
    expect(requestGuide).toHaveBeenCalledWith({ item_id: 'i', step_id: 's' });
    expect(store.getState().mode).toEqual({
      kind: 'showing-guide',
      result: { type: 'guide', message: 'click', confidence: 'high' },
    });
  });

  it('requestGuide() dispatches ERROR when api throws DaemonHttpError 503', async () => {
    const err = new (class extends Error {
      status = 503;
      body = { error: 'vision_api_timeout' };
      constructor() {
        super('boom');
        this.name = 'DaemonHttpError';
      }
    })();
    const store = createStore({
      api: {
        getChecklist: vi.fn(),
        requestGuide: vi.fn().mockRejectedValue(err),
        requestVerify: vi.fn(),
        getRateLimit: vi.fn(),
        getConsents: vi.fn(),
      },
    });
    store.dispatch({
      type: 'SET_CONTEXT',
      context: { itemId: 'i', stepId: 's', stepIndex: 0, totalSteps: 1 },
      stepIds: ['s'],
    });
    await store.requestGuide();
    expect(store.getState().mode).toEqual({
      kind: 'error',
      lastIntent: 'guide',
      status: 503,
      message: 'vision_api_timeout',
    });
  });

  it('requestGuide() dispatches generic 500 ERROR when api throws unknown', async () => {
    const store = createStore({
      api: {
        getChecklist: vi.fn(),
        requestGuide: vi.fn().mockRejectedValue(new Error('network')),
        requestVerify: vi.fn(),
        getRateLimit: vi.fn(),
        getConsents: vi.fn(),
      },
    });
    store.dispatch({
      type: 'SET_CONTEXT',
      context: { itemId: 'i', stepId: 's', stepIndex: 0, totalSteps: 1 },
      stepIds: ['s'],
    });
    await store.requestGuide();
    expect(store.getState().mode.kind).toBe('error');
  });

  it('requestVerify() dispatches REQUEST_VERIFY then VERIFY_SUCCESS', async () => {
    const requestVerify = vi.fn().mockResolvedValue({
      call_id: 'vc_2',
      result: {
        type: 'verify',
        status: 'fail',
        reasoning: 'not yet',
        next_action_hint: 'try again',
      },
    });
    const store = createStore({
      api: {
        getChecklist: vi.fn(),
        requestGuide: vi.fn(),
        requestVerify,
        getRateLimit: vi.fn(),
        getConsents: vi.fn(),
      },
    });
    store.dispatch({
      type: 'SET_CONTEXT',
      context: { itemId: 'i', stepId: 's', stepIndex: 0, totalSteps: 1 },
      stepIds: ['s'],
    });
    await store.requestVerify();
    expect(requestVerify).toHaveBeenCalledWith({ item_id: 'i', step_id: 's' });
    const m = store.getState().mode;
    expect(m.kind).toBe('showing-verify');
  });

  it('retry() re-runs the last failing intent', async () => {
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
        cached: false,
        latency_ms: 50,
        result: { type: 'guide', message: 'ok', confidence: 'medium' },
      });
    const store = createStore({
      api: {
        getChecklist: vi.fn(),
        requestGuide,
        requestVerify: vi.fn(),
        getRateLimit: vi.fn(),
        getConsents: vi.fn(),
      },
    });
    store.dispatch({
      type: 'SET_CONTEXT',
      context: { itemId: 'i', stepId: 's', stepIndex: 0, totalSteps: 1 },
      stepIds: ['s'],
    });
    await store.requestGuide();
    expect(store.getState().mode.kind).toBe('error');
    await store.retry();
    expect(requestGuide).toHaveBeenCalledTimes(2);
    expect(store.getState().mode).toEqual({
      kind: 'showing-guide',
      result: { type: 'guide', message: 'ok', confidence: 'medium' },
    });
  });

  it('retry() with no last intent is a no-op', async () => {
    const requestGuide = vi.fn();
    const store = createStore({
      api: {
        getChecklist: vi.fn(),
        requestGuide,
        requestVerify: vi.fn(),
        getRateLimit: vi.fn(),
        getConsents: vi.fn(),
      },
    });
    await store.retry();
    expect(requestGuide).not.toHaveBeenCalled();
  });
});
