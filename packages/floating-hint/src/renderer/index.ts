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
  const api = createRendererApi();
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
      onVerify: () => {
        void store.requestVerify();
      },
      onRetry: () => {
        void store.retry();
      },
      onOpenSettings: () => {
        // Phase 2 hook — for now nudge the user via the response panel.
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
