import type {
  ChecklistItem,
  HighlightRegion,
  ItemState,
  VisionGuideResult,
  VisionVerifyResult,
} from '@onboarding/shared';
import {
  initialState,
  reduce,
  type AppState,
  type ApiErrorBody,
  type Event,
  type RateLimitInfo,
  type UiContext,
} from './machine.js';

export interface VisionGuideResponse {
  call_id: string;
  cached?: boolean;
  latency_ms?: number;
  result: VisionGuideResult;
}

export interface VisionVerifyResponse {
  call_id: string;
  result: VisionVerifyResult;
}

export interface ChecklistResponse {
  items: Array<ItemState & { title: string }>;
}

export interface RendererApi {
  getChecklist(): Promise<ChecklistResponse>;
  requestGuide(input: { item_id: string; step_id: string }): Promise<VisionGuideResponse>;
  requestVerify(input: { item_id: string; step_id: string }): Promise<VisionVerifyResponse>;
  getRateLimit(): Promise<RateLimitInfo>;
  getConsents(): Promise<unknown>;
}

export interface OverlayClient {
  show(region: HighlightRegion): void;
  hide(): void;
}

export interface CreateStoreOptions {
  api?: RendererApi;
  checklist?: ChecklistItem[];
  pollIntervalMs?: number;
  overlay?: OverlayClient;
}

export interface Store {
  getState(): AppState;
  subscribe(listener: (state: AppState) => void): () => void;
  dispatch(event: Event): void;
  startChecklistPoll(): void;
  stopChecklistPoll(): void;
  requestGuide(): Promise<void>;
  requestVerify(): Promise<void>;
  retry(): Promise<void>;
}

export const DEFAULT_POLL_INTERVAL_MS = 5_000;

interface DaemonHttpErrorLike {
  name: 'DaemonHttpError';
  status: number;
  body: ApiErrorBody | null;
}

function isDaemonHttpError(err: unknown): err is DaemonHttpErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'DaemonHttpError' &&
    typeof (err as { status?: unknown }).status === 'number'
  );
}

function lastIntent(state: AppState): 'guide' | 'verify' | null {
  switch (state.mode.kind) {
    case 'loading':
      return state.mode.pending;
    case 'error':
    case 'rate-paused':
    case 'consent-blocked':
      return state.mode.lastIntent;
    case 'showing-guide':
      return 'guide';
    case 'showing-verify':
      return 'verify';
    default:
      return null;
  }
}

export function createStore(options: CreateStoreOptions = {}): Store {
  let state: AppState = initialState;
  const listeners = new Set<(s: AppState) => void>();
  const checklist = options.checklist ?? [];
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const api = options.api;
  const overlay = options.overlay;
  let pollHandle: ReturnType<typeof setInterval> | null = null;

  function setState(next: AppState): void {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener(state);
  }

  function dispatch(event: Event): void {
    setState(reduce(state, event));
  }

  function findItem(itemId: string): ChecklistItem | undefined {
    return checklist.find((item) => item.id === itemId);
  }

  function deriveContext(
    items: ChecklistResponse['items'],
  ): { context: UiContext; stepIds: string[] } | null {
    const active =
      items.find((i) => i.status === 'in_progress') ??
      items.find((i) => i.status === 'pending');
    if (!active) return null;
    const item = findItem(active.item_id);
    const steps = item?.ai_coaching?.steps ?? [];
    const stepIds = steps.map((s) => s.id);
    const currentStepId =
      active.current_step ??
      stepIds[0] ??
      null;
    const stepIndex = currentStepId
      ? Math.max(0, stepIds.indexOf(currentStepId))
      : 0;
    return {
      context: {
        itemId: active.item_id,
        stepId: currentStepId,
        stepIndex,
        totalSteps: stepIds.length,
      },
      stepIds,
    };
  }

  async function syncChecklist(): Promise<void> {
    if (!api) return;
    try {
      const data = await api.getChecklist();
      const derived = deriveContext(data.items);
      if (derived) {
        dispatch({
          type: 'SET_CONTEXT',
          context: derived.context,
          stepIds: derived.stepIds,
        });
      }
    } catch {
      // Network/server error during poll: leave existing state.
    }
  }

  function startChecklistPoll(): void {
    if (pollHandle !== null) return;
    void syncChecklist();
    pollHandle = setInterval(() => {
      void syncChecklist();
    }, pollIntervalMs);
  }

  function stopChecklistPoll(): void {
    if (pollHandle !== null) {
      clearInterval(pollHandle);
      pollHandle = null;
    }
  }

  function errorEvent(err: unknown): Event {
    if (isDaemonHttpError(err)) {
      return { type: 'ERROR', status: err.status, body: err.body };
    }
    return { type: 'ERROR', status: 500, body: null };
  }

  function applyGuideOverlay(result: VisionGuideResult): void {
    if (!overlay) return;
    if (result.highlight_region) {
      overlay.show(result.highlight_region);
    } else {
      overlay.hide();
    }
  }

  async function performGuide(): Promise<void> {
    if (!api) return;
    const ctx = state.context;
    if (!ctx.itemId || !ctx.stepId) return;
    try {
      const res = await api.requestGuide({
        item_id: ctx.itemId,
        step_id: ctx.stepId,
      });
      applyGuideOverlay(res.result);
      dispatch({ type: 'GUIDE_SUCCESS', result: res.result });
    } catch (err) {
      overlay?.hide();
      dispatch(errorEvent(err));
    }
  }

  async function performVerify(): Promise<void> {
    if (!api) return;
    const ctx = state.context;
    if (!ctx.itemId || !ctx.stepId) return;
    try {
      const res = await api.requestVerify({
        item_id: ctx.itemId,
        step_id: ctx.stepId,
      });
      dispatch({ type: 'VERIFY_SUCCESS', result: res.result });
    } catch (err) {
      dispatch(errorEvent(err));
    }
  }

  async function requestGuide(): Promise<void> {
    if (!state.context.itemId || !state.context.stepId) return;
    dispatch({ type: 'REQUEST_GUIDE' });
    if (state.mode.kind !== 'loading') return;
    await performGuide();
  }

  async function requestVerify(): Promise<void> {
    if (!state.context.itemId || !state.context.stepId) return;
    overlay?.hide();
    dispatch({ type: 'REQUEST_VERIFY' });
    if (state.mode.kind !== 'loading') return;
    await performVerify();
  }

  async function retry(): Promise<void> {
    const intent = lastIntent(state);
    if (intent === null) return;
    dispatch({ type: 'RETRY' });
    if (state.mode.kind !== 'loading') return;
    if (intent === 'guide') {
      await performGuide();
    } else {
      await performVerify();
    }
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch,
    startChecklistPoll,
    stopChecklistPoll,
    requestGuide,
    requestVerify,
    retry,
  };
}
