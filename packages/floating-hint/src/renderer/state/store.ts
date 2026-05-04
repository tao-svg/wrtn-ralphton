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
  prevStep(): void;
  nextStep(): void;
  openCurrentUrl(): Promise<void>;
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
    // PoC: daemon이 ai_coaching을 응답에 포함하므로 그걸 우선 사용.
    // (createStore options.checklist는 PoC에선 빈 채로 두는 케이스)
    const apiActive = active as typeof active & {
      ai_coaching?: { steps?: Array<{ id: string }> };
    };
    const apiSteps = apiActive.ai_coaching?.steps ?? [];
    const stepIds = apiSteps.length > 0
      ? apiSteps.map((s) => s.id)
      : (findItem(active.item_id)?.ai_coaching?.steps ?? []).map((s) => s.id);
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
        // PoC: itemId가 바뀐 경우(또는 첫 동기화)에만 stepIndex를 daemon 기준으로 reset.
        // 같은 item에서는 [✓ 진행 확인]으로 진행한 stepIndex를 polling이 덮어쓰지 않도록.
        const sameItem =
          state.context.itemId === derived.context.itemId &&
          state.stepIds.length === derived.stepIds.length;
        if (!sameItem) {
          dispatch({
            type: 'SET_CONTEXT',
            context: derived.context,
            stepIds: derived.stepIds,
          });
        }
      }
      // PoC: daemon 응답이 ai_coaching/clipboard_inject까지 노출하므로 activeItem 자체도 보관.
      const items = data.items as Array<{
        item_id: string;
        title: string;
        status: string;
        ai_coaching?: { overall_goal: string; steps: Array<{ id: string; intent: string; success_criteria: string }> };
        clipboard_inject?: { command: string; ui_hint?: string };
      }>;
      const active = items.find((i) => i.status === 'in_progress')
        ?? items.find((i) => i.status === 'pending');
      if (active) {
        dispatch({
          type: 'SET_ACTIVE_ITEM',
          activeItem: {
            item_id: active.item_id,
            title: active.title,
            ai_coaching: active.ai_coaching,
            clipboard_inject: active.clipboard_inject,
          },
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
    if (!state.context.itemId) return;
    // [PoC fallback] renderer doesn't ship the yaml; use a default step id when
    // the daemon's /api/checklist response lacks ai_coaching detail.
    if (!state.context.stepId) {
      state = { ...state, context: { ...state.context, stepId: 'navigate' } };
    }
    dispatch({ type: 'REQUEST_GUIDE' });
    if (state.mode.kind !== 'loading') return;
    await performGuide();
  }

  async function requestVerify(): Promise<void> {
    if (!state.context.itemId) return;
    if (!state.context.stepId) {
      state = { ...state, context: { ...state.context, stepId: 'navigate' } };
    }
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

  function prevStep(): void {
    dispatch({ type: 'GO_PREV_STEP' });
  }

  function nextStep(): void {
    dispatch({ type: 'GO_NEXT_STEP' });
  }

  async function openCurrentUrl(): Promise<void> {
    const cmd = state.activeItem?.clipboard_inject?.command;
    if (!cmd) return;
    const match = cmd.match(/https?:\/\/[^\s'"]+/);
    const url = match?.[0];
    if (!url) return;
    const bridge = (globalThis as { daemonClient?: { openUrl?: (u: string) => Promise<unknown> } })
      .daemonClient;
    if (bridge?.openUrl) {
      await bridge.openUrl(url);
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
    prevStep,
    nextStep,
    openCurrentUrl,
  };
}
