// Preload for the overlay window. Exposes a tiny bridge for the overlay
// renderer to subscribe to `overlay:render` and `overlay:clear` events that
// main forwards via webContents.send().

import { contextBridge, ipcRenderer } from 'electron';
import type { CssRect } from '../renderer/overlay/coords.js';

export interface OverlayBridge {
  onRender(cb: (rect: CssRect) => void): () => void;
  onClear(cb: () => void): () => void;
}

const bridge: OverlayBridge = {
  onRender: (cb) => {
    const handler = (_event: unknown, rect: CssRect): void => cb(rect);
    ipcRenderer.on('overlay:render', handler);
    return () => {
      ipcRenderer.removeListener('overlay:render', handler);
    };
  },
  onClear: (cb) => {
    const handler = (): void => cb();
    ipcRenderer.on('overlay:clear', handler);
    return () => {
      ipcRenderer.removeListener('overlay:clear', handler);
    };
  },
};

contextBridge.exposeInMainWorld('overlayBridge', bridge);
