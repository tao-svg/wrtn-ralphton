import { describe, it, expect } from 'vitest';
import {
  initialState,
  reduce,
  type AppState,
  type Event,
} from '../src/renderer/state/machine.js';

const baseContext = {
  itemId: 'install-homebrew',
  stepId: 'click-lock',
  stepIndex: 1,
  totalSteps: 3,
};

function withContext(state: AppState): AppState {
  return { ...state, context: { ...baseContext } };
}

describe('initialState', () => {
  it('starts in idle with no item/step', () => {
    expect(initialState.mode).toEqual({ kind: 'idle' });
    expect(initialState.context.itemId).toBeNull();
    expect(initialState.context.stepId).toBeNull();
  });
});

describe('reduce', () => {
  it('transitions idle → loading on REQUEST_GUIDE', () => {
    const start = withContext(initialState);
    const next = reduce(start, { type: 'REQUEST_GUIDE' });
    expect(next.mode).toEqual({ kind: 'loading', pending: 'guide' });
    expect(next.context).toEqual(start.context);
  });

  it('transitions idle → loading on REQUEST_VERIFY', () => {
    const next = reduce(withContext(initialState), { type: 'REQUEST_VERIFY' });
    expect(next.mode).toEqual({ kind: 'loading', pending: 'verify' });
  });

  it('refuses REQUEST_GUIDE when no current item/step', () => {
    const next = reduce(initialState, { type: 'REQUEST_GUIDE' });
    expect(next.mode).toEqual({ kind: 'idle' });
  });

  it('transitions loading → showing-guide on GUIDE_SUCCESS', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: { kind: 'loading', pending: 'guide' },
    };
    const event: Event = {
      type: 'GUIDE_SUCCESS',
      result: {
        type: 'guide',
        message: '잠금 아이콘을 클릭하세요',
        confidence: 'high',
      },
    };
    const next = reduce(start, event);
    expect(next.mode).toEqual({
      kind: 'showing-guide',
      result: {
        type: 'guide',
        message: '잠금 아이콘을 클릭하세요',
        confidence: 'high',
      },
    });
  });

  it('transitions loading → showing-verify on VERIFY_SUCCESS (fail)', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: { kind: 'loading', pending: 'verify' },
    };
    const event: Event = {
      type: 'VERIFY_SUCCESS',
      result: {
        type: 'verify',
        status: 'fail',
        reasoning: '아직 클릭 안 했음',
        next_action_hint: '왼쪽 아래 잠금 아이콘 클릭',
      },
    };
    const next = reduce(start, event);
    expect(next.mode).toEqual({
      kind: 'showing-verify',
      result: event.result,
    });
    expect(next.context.stepIndex).toBe(1);
  });

  it('advances stepIndex on VERIFY_SUCCESS pass when next step exists', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: { kind: 'loading', pending: 'verify' },
      stepIds: ['s0', 's1', 's2'],
    };
    start.context = {
      itemId: 'i',
      stepId: 's1',
      stepIndex: 1,
      totalSteps: 3,
    };
    const next = reduce(start, {
      type: 'VERIFY_SUCCESS',
      result: { type: 'verify', status: 'pass', reasoning: 'ok' },
    });
    expect(next.context.stepIndex).toBe(2);
    expect(next.context.stepId).toBe('s2');
    expect(next.mode).toEqual({
      kind: 'showing-verify',
      result: { type: 'verify', status: 'pass', reasoning: 'ok' },
    });
  });

  it('keeps stepIndex on VERIFY_SUCCESS pass when no next step', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: { kind: 'loading', pending: 'verify' },
      stepIds: ['s0', 's1'],
    };
    start.context = {
      itemId: 'i',
      stepId: 's1',
      stepIndex: 1,
      totalSteps: 2,
    };
    const next = reduce(start, {
      type: 'VERIFY_SUCCESS',
      result: { type: 'verify', status: 'pass', reasoning: 'done' },
    });
    expect(next.context.stepIndex).toBe(1);
  });

  it('transitions loading → error on ERROR 503', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: { kind: 'loading', pending: 'guide' },
    };
    const next = reduce(start, {
      type: 'ERROR',
      status: 503,
      body: { error: 'vision_api_timeout' },
    });
    expect(next.mode).toEqual({
      kind: 'error',
      lastIntent: 'guide',
      status: 503,
      message: 'vision_api_timeout',
    });
  });

  it('transitions loading → rate-paused on ERROR 429 paused', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: { kind: 'loading', pending: 'verify' },
    };
    const next = reduce(start, {
      type: 'ERROR',
      status: 429,
      body: {
        error: 'rate_limit_exceeded',
        state: 'paused',
        reset_at: 1_700_000_000,
      },
    });
    expect(next.mode).toEqual({
      kind: 'rate-paused',
      resetAt: 1_700_000_000,
      lastIntent: 'verify',
    });
  });

  it('transitions loading → error on ERROR 429 throttled (not paused)', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: { kind: 'loading', pending: 'guide' },
    };
    const next = reduce(start, {
      type: 'ERROR',
      status: 429,
      body: { error: 'rate_limit_exceeded', state: 'alert' },
    });
    expect(next.mode.kind).toBe('error');
    if (next.mode.kind === 'error') {
      expect(next.mode.status).toBe(429);
    }
  });

  it('transitions loading → consent-blocked on ERROR 403', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: { kind: 'loading', pending: 'guide' },
    };
    const next = reduce(start, {
      type: 'ERROR',
      status: 403,
      body: { error: 'consent_required' },
    });
    expect(next.mode).toEqual({
      kind: 'consent-blocked',
      reason: 'consent_required',
      lastIntent: 'guide',
    });
  });

  it('transitions loading → consent-blocked on ERROR 401', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: { kind: 'loading', pending: 'guide' },
    };
    const next = reduce(start, {
      type: 'ERROR',
      status: 401,
      body: { error: 'screen_recording_permission_required' },
    });
    expect(next.mode).toEqual({
      kind: 'consent-blocked',
      reason: 'screen_recording',
      lastIntent: 'guide',
    });
  });

  it('falls back to generic error on unknown status', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: { kind: 'loading', pending: 'guide' },
    };
    const next = reduce(start, {
      type: 'ERROR',
      status: 500,
      body: null,
    });
    expect(next.mode).toEqual({
      kind: 'error',
      lastIntent: 'guide',
      status: 500,
      message: 'unknown_error',
    });
  });

  it('RETRY from error returns to loading with last intent', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: {
        kind: 'error',
        lastIntent: 'verify',
        status: 503,
        message: 'vision_api_timeout',
      },
    };
    const next = reduce(start, { type: 'RETRY' });
    expect(next.mode).toEqual({ kind: 'loading', pending: 'verify' });
  });

  it('RETRY from rate-paused returns to loading with last intent', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: {
        kind: 'rate-paused',
        resetAt: 0,
        lastIntent: 'guide',
      },
    };
    const next = reduce(start, { type: 'RETRY' });
    expect(next.mode).toEqual({ kind: 'loading', pending: 'guide' });
  });

  it('RETRY from idle is a no-op', () => {
    const next = reduce(initialState, { type: 'RETRY' });
    expect(next).toBe(initialState);
  });

  it('RESOLVE_CONSENT moves consent-blocked → idle', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: {
        kind: 'consent-blocked',
        reason: 'consent_required',
        lastIntent: 'guide',
      },
    };
    const next = reduce(start, { type: 'RESOLVE_CONSENT' });
    expect(next.mode).toEqual({ kind: 'idle' });
  });

  it('SET_CONTEXT updates the current item/step pointer', () => {
    const next = reduce(initialState, {
      type: 'SET_CONTEXT',
      context: {
        itemId: 'install-git',
        stepId: 'configure-name',
        stepIndex: 0,
        totalSteps: 2,
      },
      stepIds: ['configure-name', 'configure-email'],
    });
    expect(next.context).toEqual({
      itemId: 'install-git',
      stepId: 'configure-name',
      stepIndex: 0,
      totalSteps: 2,
    });
    expect(next.stepIds).toEqual(['configure-name', 'configure-email']);
  });

  it('SET_RATE_LIMIT updates rate state without changing mode', () => {
    const next = reduce(withContext(initialState), {
      type: 'SET_RATE_LIMIT',
      rateLimit: { state: 'alert', current_hour_calls: 110 },
    });
    expect(next.rateLimit).toEqual({ state: 'alert', current_hour_calls: 110 });
    expect(next.mode).toEqual({ kind: 'idle' });
  });

  it('SET_CONSENTS updates consent map', () => {
    const next = reduce(initialState, {
      type: 'SET_CONSENTS',
      consents: { screen_recording: true, anthropic_transmission: false },
    });
    expect(next.consents).toEqual({
      screen_recording: true,
      anthropic_transmission: false,
    });
  });

  it('REQUEST_GUIDE while loading is rejected', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: { kind: 'loading', pending: 'guide' },
    };
    const next = reduce(start, { type: 'REQUEST_GUIDE' });
    expect(next).toBe(start);
  });

  it('REQUEST_GUIDE from showing-guide allowed (re-fetch)', () => {
    const start: AppState = {
      ...withContext(initialState),
      mode: {
        kind: 'showing-guide',
        result: { type: 'guide', message: 'old', confidence: 'low' },
      },
    };
    const next = reduce(start, { type: 'REQUEST_GUIDE' });
    expect(next.mode).toEqual({ kind: 'loading', pending: 'guide' });
  });

  it('GUIDE_SUCCESS while not loading is ignored', () => {
    const next = reduce(withContext(initialState), {
      type: 'GUIDE_SUCCESS',
      result: { type: 'guide', message: 'x', confidence: 'low' },
    });
    expect(next.mode).toEqual({ kind: 'idle' });
  });
});
