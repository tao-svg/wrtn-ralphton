import type { BrowserWindowConstructorOptions, Rectangle } from 'electron';

export const HINT_WINDOW_WIDTH = 380;
export const HINT_WINDOW_HEIGHT = 480;
export const HINT_WINDOW_MARGIN = 16;

export type WorkArea = Pick<Rectangle, 'x' | 'y' | 'width' | 'height'>;

export function calculatePosition(
  workArea: WorkArea,
  windowWidth: number = HINT_WINDOW_WIDTH,
  windowHeight: number = HINT_WINDOW_HEIGHT,
  margin: number = HINT_WINDOW_MARGIN,
): { x: number; y: number } {
  return {
    x: workArea.x + workArea.width - windowWidth - margin,
    y: workArea.y + workArea.height - windowHeight - margin,
  };
}

export function buildBrowserWindowOptions(
  workArea: WorkArea,
  preloadPath: string,
): BrowserWindowConstructorOptions {
  const { x, y } = calculatePosition(workArea);
  return {
    width: HINT_WINDOW_WIDTH,
    height: HINT_WINDOW_HEIGHT,
    x,
    y,
    alwaysOnTop: true,
    frame: true,
    transparent: false,
    backgroundColor: '#1e1e2e',
    focusable: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  };
}

export function assertSupportedPlatform(
  platform: NodeJS.Platform,
  exit: (code: number) => never,
  log: (message: string) => void = (msg) => console.error(msg),
): void {
  if (platform !== 'darwin') {
    log(
      `[floating-hint] Only macOS (darwin) is supported in MVP. ` +
        `Detected platform: ${platform}. Aborting.`,
    );
    exit(1);
  }
}
