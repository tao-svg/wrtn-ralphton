import type {
  VisionGuideResult,
  VisionVerifyResult,
} from '@onboarding/shared';

export interface UiContext {
  itemId: string | null;
  stepId: string | null;
  stepIndex: number;
  totalSteps: number;
}

export type UiMode =
  | { kind: 'idle' }
  | { kind: 'loading'; pending: 'guide' | 'verify' }
  | { kind: 'showing-guide'; result: VisionGuideResult }
  | { kind: 'showing-verify'; result: VisionVerifyResult }
  | {
      kind: 'error';
      lastIntent: 'guide' | 'verify';
      status: number;
      message: string;
    }
  | {
      kind: 'rate-paused';
      resetAt: number;
      lastIntent: 'guide' | 'verify';
    }
  | {
      kind: 'consent-blocked';
      reason: 'consent_required' | 'screen_recording';
      lastIntent: 'guide' | 'verify';
    };

export interface RateLimitInfo {
  state: 'normal' | 'alert' | 'paused';
  current_hour_calls?: number;
  reset_at?: number;
}

export interface ConsentMap {
  screen_recording: boolean;
  anthropic_transmission: boolean;
}

export interface ActiveItem {
  item_id: string;
  title: string;
  ai_coaching?: {
    overall_goal: string;
    steps: Array<{ id: string; intent: string; success_criteria: string }>;
  };
  clipboard_inject?: {
    command: string;
    ui_hint?: string;
  };
}

export interface AppState {
  mode: UiMode;
  context: UiContext;
  stepIds: string[];
  rateLimit?: RateLimitInfo;
  consents?: ConsentMap;
  activeItem?: ActiveItem;
}

export interface ApiErrorBody {
  error?: string;
  state?: string;
  reset_at?: number;
}

export type Event =
  | { type: 'REQUEST_GUIDE' }
  | { type: 'REQUEST_VERIFY' }
  | { type: 'GUIDE_SUCCESS'; result: VisionGuideResult }
  | { type: 'VERIFY_SUCCESS'; result: VisionVerifyResult }
  | { type: 'ERROR'; status: number; body: ApiErrorBody | null }
  | { type: 'RETRY' }
  | { type: 'RESOLVE_CONSENT' }
  | {
      type: 'SET_CONTEXT';
      context: UiContext;
      stepIds: string[];
    }
  | { type: 'SET_RATE_LIMIT'; rateLimit: RateLimitInfo }
  | { type: 'SET_CONSENTS'; consents: ConsentMap }
  | { type: 'SET_ACTIVE_ITEM'; activeItem: ActiveItem | undefined }
  | { type: 'GO_PREV_STEP' }
  | { type: 'GO_NEXT_STEP' };

export const initialState: AppState = Object.freeze({
  mode: { kind: 'idle' as const },
  context: {
    itemId: null,
    stepId: null,
    stepIndex: 0,
    totalSteps: 0,
  },
  stepIds: [],
});

function hasContext(state: AppState): boolean {
  return state.context.itemId !== null && state.context.stepId !== null;
}

function lastIntentOf(mode: UiMode): 'guide' | 'verify' | null {
  switch (mode.kind) {
    case 'loading':
      return mode.pending;
    case 'error':
    case 'rate-paused':
    case 'consent-blocked':
      return mode.lastIntent;
    default:
      return null;
  }
}

function classifyError(
  status: number,
  body: ApiErrorBody | null,
  intent: 'guide' | 'verify',
): UiMode {
  if (status === 401) {
    return { kind: 'consent-blocked', reason: 'screen_recording', lastIntent: intent };
  }
  if (status === 403) {
    return { kind: 'consent-blocked', reason: 'consent_required', lastIntent: intent };
  }
  if (status === 429 && body?.state === 'paused') {
    return {
      kind: 'rate-paused',
      resetAt: body.reset_at ?? 0,
      lastIntent: intent,
    };
  }
  return {
    kind: 'error',
    lastIntent: intent,
    status,
    message: body?.error ?? 'unknown_error',
  };
}

export function reduce(state: AppState, event: Event): AppState {
  switch (event.type) {
    case 'REQUEST_GUIDE': {
      if (state.mode.kind === 'loading') return state;
      if (!hasContext(state)) return state;
      return { ...state, mode: { kind: 'loading', pending: 'guide' } };
    }
    case 'REQUEST_VERIFY': {
      if (state.mode.kind === 'loading') return state;
      if (!hasContext(state)) return state;
      return { ...state, mode: { kind: 'loading', pending: 'verify' } };
    }
    case 'GUIDE_SUCCESS': {
      if (state.mode.kind !== 'loading' || state.mode.pending !== 'guide') {
        return state;
      }
      return {
        ...state,
        mode: { kind: 'showing-guide', result: event.result },
      };
    }
    case 'VERIFY_SUCCESS': {
      if (state.mode.kind !== 'loading' || state.mode.pending !== 'verify') {
        return state;
      }
      let context = state.context;
      if (event.result.status === 'pass') {
        const nextIndex = state.context.stepIndex + 1;
        if (nextIndex < state.stepIds.length) {
          context = {
            ...state.context,
            stepIndex: nextIndex,
            stepId: state.stepIds[nextIndex] ?? state.context.stepId,
          };
        }
      }
      return {
        ...state,
        context,
        mode: { kind: 'showing-verify', result: event.result },
      };
    }
    case 'ERROR': {
      const intent = lastIntentOf(state.mode);
      if (intent === null) return state;
      return { ...state, mode: classifyError(event.status, event.body, intent) };
    }
    case 'RETRY': {
      const intent = lastIntentOf(state.mode);
      if (intent === null) return state;
      return { ...state, mode: { kind: 'loading', pending: intent } };
    }
    case 'RESOLVE_CONSENT': {
      if (state.mode.kind !== 'consent-blocked') return state;
      return { ...state, mode: { kind: 'idle' } };
    }
    case 'SET_CONTEXT': {
      return { ...state, context: event.context, stepIds: event.stepIds };
    }
    case 'SET_RATE_LIMIT': {
      return { ...state, rateLimit: event.rateLimit };
    }
    case 'SET_CONSENTS': {
      return { ...state, consents: event.consents };
    }
    case 'SET_ACTIVE_ITEM': {
      return { ...state, activeItem: event.activeItem };
    }
    case 'GO_PREV_STEP': {
      const nextIndex = Math.max(0, state.context.stepIndex - 1);
      if (nextIndex === state.context.stepIndex) return state;
      const nextStepId = state.stepIds[nextIndex] ?? state.context.stepId;
      return {
        ...state,
        context: { ...state.context, stepIndex: nextIndex, stepId: nextStepId },
      };
    }
    case 'GO_NEXT_STEP': {
      const max = state.stepIds.length - 1;
      const nextIndex = Math.min(max, state.context.stepIndex + 1);
      if (nextIndex === state.context.stepIndex) return state;
      const nextStepId = state.stepIds[nextIndex] ?? state.context.stepId;
      return {
        ...state,
        context: { ...state.context, stepIndex: nextIndex, stepId: nextStepId },
      };
    }
  }
}
