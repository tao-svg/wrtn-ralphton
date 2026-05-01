import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertSupportedPlatform,
  buildBrowserWindowOptions,
} from './window-options.js';
import {
  createOverlayWindow,
  registerOverlayIpc,
  type OverlayBrowserWindowLike,
} from './overlay-window.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'index.js');
const RENDERER_HTML_PATH = path.join(__dirname, '..', 'renderer', 'index.html');
const OVERLAY_PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'overlay.js');
const OVERLAY_HTML_PATH = path.join(
  __dirname,
  '..',
  'renderer',
  'overlay',
  'index.html',
);

function createMainWindow(): BrowserWindow {
  const primary = screen.getPrimaryDisplay();
  const opts = buildBrowserWindowOptions(primary.workArea, PRELOAD_PATH);
  const win = new BrowserWindow(opts);
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  void win.loadFile(RENDERER_HTML_PATH).then(() => {
    win.show();
  });
  return win;
}

function createOverlay(): OverlayBrowserWindowLike {
  const primary = screen.getPrimaryDisplay();
  return createOverlayWindow(BrowserWindow as never, {
    workArea: primary.workArea,
    preloadPath: OVERLAY_PRELOAD_PATH,
    htmlPath: OVERLAY_HTML_PATH,
  });
}

let mainWindow: BrowserWindow | null = null;
let overlayWindow: OverlayBrowserWindowLike | null = null;

function bootstrap(): void {
  assertSupportedPlatform(
    process.platform,
    process.exit.bind(process) as (code: number) => never,
  );

  void app.whenReady().then(() => {
    mainWindow = createMainWindow();
    overlayWindow = createOverlay();
    registerOverlayIpc(
      ipcMain,
      () => overlayWindow,
      () => {
        const display = screen.getPrimaryDisplay();
        return {
          width: display.workArea.width,
          height: display.workArea.height,
          scaleFactor: display.scaleFactor,
        };
      },
    );
    app.on('activate', () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        mainWindow = createMainWindow();
      }
      if (!overlayWindow || overlayWindow.isDestroyed()) {
        overlayWindow = createOverlay();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

bootstrap();
