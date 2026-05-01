// Overlay renderer entry — runs inside the transparent click-through window.
// Subscribes to `overlay:render` / `overlay:clear` events forwarded from main
// (see preload/overlay.ts) and toggles a single absolutely-positioned div.
//
// Excluded from coverage: this module touches `document` and `window` and is
// only meaningfully exercised inside an Electron renderer process.

import type { CssRect } from './coords.js';

interface OverlayBridge {
  onRender(cb: (rect: CssRect) => void): () => void;
  onClear(cb: () => void): () => void;
}

const FADE_OUT_MS = 4000;
let timer: ReturnType<typeof setTimeout> | null = null;

function getBox(): HTMLElement | null {
  return document.getElementById('overlay-box');
}

function applyRect(box: HTMLElement, rect: CssRect): void {
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}

function showRect(rect: CssRect): void {
  const box = getBox();
  if (!box) return;
  applyRect(box, rect);
  box.hidden = false;
  // Force reflow so the .visible transition replays on a fresh region.
  void box.offsetWidth;
  box.classList.add('visible');
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    clearOverlay();
  }, FADE_OUT_MS);
}

function clearOverlay(): void {
  const box = getBox();
  if (!box) return;
  box.classList.remove('visible');
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function bootstrap(): void {
  const bridge = (globalThis as { overlayBridge?: OverlayBridge })
    .overlayBridge;
  if (!bridge) return;
  bridge.onRender((rect) => showRect(rect));
  bridge.onClear(() => clearOverlay());
}

bootstrap();
