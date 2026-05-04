// Overlay window — the full-viewport, click-through, transparent BrowserWindow
// that draws the red highlight box (PRD F-P5PP-04, AC-VIS-09).
//
// Two responsibilities split for testability:
//
//   buildOverlayWindowOptions / createOverlayWindow
//     pure / parameterised so tests can assert flags without touching Electron.
//
//   registerOverlayIpc
//     translates `overlay:show`/`overlay:hide` IPC messages from the hint
//     window's renderer into `overlay:render`/`overlay:clear` messages on the
//     overlay's webContents, doing the vision-px → CSS-px conversion in the
//     middle so the renderer doesn't need to re-implement the transform.

import type { BrowserWindowConstructorOptions, Rectangle } from 'electron';
import type { HighlightRegion } from '@onboarding/shared';
import {
  visionRegionToCss,
  type DisplayMetrics,
} from '../renderer/overlay/coords.js';

export type WorkArea = Pick<Rectangle, 'x' | 'y' | 'width' | 'height'>;

export interface OverlayBrowserWindowLike {
  setAlwaysOnTop(top: boolean, level?: string): void;
  setIgnoreMouseEvents(
    ignore: boolean,
    options?: { forward?: boolean },
  ): void;
  setVisibleOnAllWorkspaces?(
    visible: boolean,
    options?: { visibleOnFullScreen?: boolean },
  ): void;
  loadFile(path: string): Promise<void> | unknown;
  webContents: { send(channel: string, ...args: unknown[]): void };
  show(): void;
  hide(): void;
  isDestroyed(): boolean;
}

export type OverlayBrowserWindowCtor = new (
  options: BrowserWindowConstructorOptions,
) => OverlayBrowserWindowLike;

export interface OverlayWindowOptions {
  workArea: WorkArea;
  preloadPath: string;
  htmlPath: string;
}

export function buildOverlayWindowOptions(
  workArea: WorkArea,
  preloadPath: string,
): BrowserWindowConstructorOptions {
  return {
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };
}

export function createOverlayWindow(
  BrowserWindow: OverlayBrowserWindowCtor,
  options: OverlayWindowOptions,
): OverlayBrowserWindowLike {
  const win = new BrowserWindow(
    buildOverlayWindowOptions(options.workArea, options.preloadPath),
  );
  // 'screen-saver' floats above normal floating windows so the overlay sits
  // on top of system panels, the hint window, and full-screen apps.
  win.setAlwaysOnTop(true, 'screen-saver');
  // Click-through: we forward mouse events to the apps below so the user can
  // keep clicking/typing into System Settings, Slack, etc. (AC-VIS-09).
  win.setIgnoreMouseEvents(true, { forward: true });
  if (typeof win.setVisibleOnAllWorkspaces === 'function') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  // 캡처에서 자기 자신(이전 빨간 박스 포함) 제외 — Vision이 우리 박스를
  // 다시 인식해서 좌표가 표류하는 걸 막는다.
  const winAny = win as unknown as { setContentProtection?: (on: boolean) => void };
  if (typeof winAny.setContentProtection === 'function') {
    winAny.setContentProtection(true);
  }
  void win.loadFile(options.htmlPath);
  return win;
}

export interface IpcMainLike {
  on(
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => void,
  ): void;
  removeAllListeners(channel: string): void;
}

export function registerOverlayIpc(
  ipcMain: IpcMainLike,
  getOverlay: () => OverlayBrowserWindowLike | null,
  getDisplay: () => DisplayMetrics,
): void {
  ipcMain.removeAllListeners('overlay:show');
  ipcMain.removeAllListeners('overlay:hide');

  ipcMain.on('overlay:show', (_event, region: unknown) => {
    const overlay = getOverlay();
    if (!overlay || overlay.isDestroyed()) return;
    const rect = visionRegionToCss(
      region as HighlightRegion | null | undefined,
      getDisplay(),
    );
    if (!rect) return;
    overlay.webContents.send('overlay:render', rect);
    overlay.show();
  });

  ipcMain.on('overlay:hide', () => {
    const overlay = getOverlay();
    if (!overlay || overlay.isDestroyed()) return;
    overlay.webContents.send('overlay:clear');
    overlay.hide();
  });
}
