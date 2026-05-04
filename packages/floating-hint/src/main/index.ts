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

const PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'index.cjs');
const RENDERER_HTML_PATH = path.join(__dirname, '..', 'renderer', 'index.html');
const OVERLAY_PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'overlay.cjs');
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
  // 'screen-saver' level (reference impl): top-most + still receives clicks.
  // 'floating' level on macOS makes the window panel-like and can swallow clicks.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // [DEBUG] forward all renderer console messages to main stdout
  win.webContents.on('console-message', (_event, level, message, line, source) => {
    console.log(`[renderer:${level}] ${message} (${source}:${line})`);
  });
  // [DEBUG] forward unhandled renderer errors
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer-gone]', details);
  });

  void win.loadFile(RENDERER_HTML_PATH).then(() => {
    win.show();
    win.webContents.openDevTools({ mode: 'detach' });

    // [DEBUG] after mount settles, dump DOM and globals
    setTimeout(() => {
      void win.webContents
        .executeJavaScript(
          `JSON.stringify({
             appHTML: (document.getElementById('app')?.innerHTML ?? '(no #app)').slice(0, 500),
             buttons: Array.from(document.querySelectorAll('button')).map(b => ({
               testid: b.getAttribute('data-testid'),
               text: b.textContent,
               disabled: b.disabled,
             })),
             daemonClient: typeof window.daemonClient,
             overlayController: typeof window.overlayController,
           })`,
        )
        .then((result) => console.log('[debug-dump]', result))
        .catch((err) => console.error('[debug-dump-fail]', err));
    }, 2000);
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
