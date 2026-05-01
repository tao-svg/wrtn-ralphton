import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertSupportedPlatform,
  buildBrowserWindowOptions,
} from './window-options.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'index.js');
const RENDERER_HTML_PATH = path.join(__dirname, '..', 'renderer', 'index.html');

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

let mainWindow: BrowserWindow | null = null;

function bootstrap(): void {
  assertSupportedPlatform(
    process.platform,
    process.exit.bind(process) as (code: number) => never,
  );

  void app.whenReady().then(() => {
    mainWindow = createMainWindow();
    app.on('activate', () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        mainWindow = createMainWindow();
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
