import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const browserWindowMock = vi.fn().mockImplementation(() => ({
  setAlwaysOnTop: vi.fn(),
  setVisibleOnAllWorkspaces: vi.fn(),
  setIgnoreMouseEvents: vi.fn(),
  loadFile: vi.fn().mockResolvedValue(undefined),
  show: vi.fn(),
  hide: vi.fn(),
  isDestroyed: () => false,
  webContents: { on: vi.fn(), send: vi.fn() },
  on: vi.fn(),
}));

const appMock = {
  whenReady: vi.fn(() => Promise.resolve()),
  on: vi.fn(),
  quit: vi.fn(),
};

const ipcMainMock = {
  on: vi.fn(),
  removeAllListeners: vi.fn(),
};

vi.mock('electron', () => ({
  app: appMock,
  BrowserWindow: browserWindowMock,
  ipcMain: ipcMainMock,
  screen: {
    getPrimaryDisplay: () => ({
      workArea: { x: 0, y: 25, width: 1440, height: 875 },
      scaleFactor: 2,
    }),
  },
  contextBridge: { exposeInMainWorld: vi.fn() },
}));

const originalPlatform = process.platform;

beforeAll(() => {
  Object.defineProperty(process, 'platform', {
    value: 'darwin',
    configurable: true,
  });
});

afterAll(() => {
  Object.defineProperty(process, 'platform', {
    value: originalPlatform,
    configurable: true,
  });
});

describe('main process smoke', () => {
  it('boots the Electron app and creates both the hint and overlay BrowserWindows', async () => {
    browserWindowMock.mockClear();
    appMock.whenReady.mockClear();
    appMock.on.mockClear();
    ipcMainMock.on.mockClear();
    ipcMainMock.removeAllListeners.mockClear();

    await import('../src/main/index.js');
    // Allow whenReady().then(...) microtasks to run.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(appMock.whenReady).toHaveBeenCalled();
    expect(browserWindowMock).toHaveBeenCalledTimes(2);

    const hintOpts = browserWindowMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(hintOpts).toBeTruthy();
    expect(hintOpts.alwaysOnTop).toBe(true);
    expect(hintOpts.frame).toBe(false);
    expect(hintOpts.transparent).toBe(true);
    expect(hintOpts.backgroundColor).toBe('#00000000');
    expect(hintOpts.focusable).toBe(false);
    expect(hintOpts.width).toBe(360);
    expect(hintOpts.height).toBe(200);

    const overlayOpts = browserWindowMock.mock.calls[1]?.[0] as Record<
      string,
      unknown
    >;
    expect(overlayOpts).toBeTruthy();
    expect(overlayOpts.transparent).toBe(true);
    expect(overlayOpts.focusable).toBe(false);
    expect(overlayOpts.hasShadow).toBe(false);
    expect(overlayOpts.width).toBe(1440);
    expect(overlayOpts.height).toBe(875);
    expect(overlayOpts.show).toBe(false);

    const hintWin = browserWindowMock.mock.results[0]?.value as {
      setAlwaysOnTop: ReturnType<typeof vi.fn>;
      loadFile: ReturnType<typeof vi.fn>;
    };
    expect(hintWin.setAlwaysOnTop).toHaveBeenCalledWith(true, 'floating');
    expect(hintWin.loadFile).toHaveBeenCalled();

    const overlayWin = browserWindowMock.mock.results[1]?.value as {
      setAlwaysOnTop: ReturnType<typeof vi.fn>;
      setIgnoreMouseEvents: ReturnType<typeof vi.fn>;
      loadFile: ReturnType<typeof vi.fn>;
    };
    expect(overlayWin.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    expect(overlayWin.setIgnoreMouseEvents).toHaveBeenCalledWith(true, {
      forward: true,
    });
    expect(overlayWin.loadFile).toHaveBeenCalled();

    expect(ipcMainMock.on).toHaveBeenCalledWith(
      'overlay:show',
      expect.any(Function),
    );
    expect(ipcMainMock.on).toHaveBeenCalledWith(
      'overlay:hide',
      expect.any(Function),
    );
  });
});
