// Renderer entry — wires the store, daemon-client bridge, and component tree to
// the live DOM. This module is intentionally untestable end-to-end (it touches
// `window`, `document`, and Electron's preload bridge); see vitest.config.ts
// where it is excluded from coverage. All non-trivial logic lives in modules
// that are unit-tested.

import { HintWindow } from './components/HintWindow.js';
import { applyVNode, type DomLike } from './dom-mount.js';
import { createRendererApi, resolveOverlayClient } from './api.js';
import { createStore } from './state/store.js';

const RATE_TICK_MS = 1_000;

function bootstrap(): void {
  const root = document.getElementById('app');
  if (!root) return;

  // [DEBUG] global click/mousedown probes — capture phase to see ALL events
  document.addEventListener('mousedown', (e) => {
    const t = e.target as HTMLElement;
    console.log('[probe:mousedown]', t.tagName, t.dataset?.testid ?? '(no-testid)');
  }, true);
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    console.log('[probe:click]', t.tagName, t.dataset?.testid ?? '(no-testid)');
  }, true);
  console.log('[probe] global listeners attached');
  let api;
  try {
    api = createRendererApi();
  } catch (e) {
    root.textContent = `[bootstrap error] ${(e as Error).message}`;
    console.error('renderer bootstrap failed', e);
    return;
  }
  const overlay = resolveOverlayClient();
  const store = createStore({ api, overlay });
  const dom: DomLike = {
    createElement: (tag) =>
      document.createElement(tag) as unknown as ReturnType<DomLike['createElement']>,
    createTextNode: (text) =>
      document.createTextNode(text) as unknown as ReturnType<
        DomLike['createTextNode']
      >,
  };
  const rootDom = root as unknown as Parameters<typeof applyVNode>[1];

  function render(): void {
    const tree = HintWindow({
      state: store.getState(),
      now: Date.now(),
      onGuide: () => {
        void store.requestGuide();
      },
      onRetry: () => {
        void store.retry();
      },
      onOpenSettings: () => {
        // Phase 2 hook — for now nudge the user via the response panel.
      },
      onNextStep: () => store.nextStep(),
      onOpenUrl: () => {
        void store.openCurrentUrl();
      },
    });
    applyVNode(tree, rootDom, dom);
  }

  store.subscribe(render);
  store.startChecklistPoll();
  setInterval(() => {
    if (store.getState().mode.kind === 'rate-paused') render();
  }, RATE_TICK_MS);
  render();
}

bootstrap();
