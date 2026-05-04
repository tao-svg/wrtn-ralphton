import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
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
  // 캡처 시 우리 자신을 화면에서 제외 — 그래야 Vision이 floating-hint UI 자체를
  // "버튼"으로 잘못 인식해 가리키지 않는다 (macOS).
  if (typeof win.setContentProtection === 'function') {
    win.setContentProtection(true);
  }

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
  // bounds (full screen incl. menuBar) — screencapture caps the entire screen
  // so overlay must align with bounds, not workArea, otherwise the vision
  // coordinates land ~25 logical px lower than the actual UI element.
  return createOverlayWindow(BrowserWindow as never, {
    workArea: primary.bounds,
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

  // Renderer가 외부 브라우저로 URL을 열 수 있게. http(s)만 허용.
  ipcMain.handle('open-url', async (_event, url: unknown) => {
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      return { ok: false, error: 'http(s) URL only' };
    }
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  void app.whenReady().then(() => {
    // [DEBUG] dump display metrics so we can verify the vision→CSS ratio
    const d = screen.getPrimaryDisplay();
    console.log('[display-metrics]', JSON.stringify({
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      size: d.size,
    }));
    mainWindow = createMainWindow();
    overlayWindow = createOverlay();
    // [DEBUG] confirm overlay actual position — macOS may clip a (0,0) window
    // below the menuBar, which would shift every box ~33 logical px down.
    const ow = overlayWindow as { getBounds?: () => unknown };
    if (typeof ow.getBounds === 'function') {
      console.log('[overlay-bounds]', JSON.stringify(ow.getBounds()));
    }
    registerOverlayIpc(
      ipcMain,
      () => overlayWindow,
      () => {
        const display = screen.getPrimaryDisplay();
        // bounds matches the screencapture frame the daemon sends to Vision.
        return {
          width: display.bounds.width,
          height: display.bounds.height,
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
