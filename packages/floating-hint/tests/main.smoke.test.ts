import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const browserWindowMock = vi.fn().mockImplementation(() => ({
  setAlwaysOnTop: vi.fn(),
  setVisibleOnAllWorkspaces: vi.fn(),
  setIgnoreMouseEvents: vi.fn(),
  loadFile: vi.fn().mockResolvedValue(undefined),
  show: vi.fn(),
  isDestroyed: () => false,
  webContents: { on: vi.fn() },
  on: vi.fn(),
}));

const appMock = {
  whenReady: vi.fn(() => Promise.resolve()),
  on: vi.fn(),
  quit: vi.fn(),
};

vi.mock('electron', () => ({
  app: appMock,
  BrowserWindow: browserWindowMock,
  screen: {
    getPrimaryDisplay: () => ({
      workArea: { x: 0, y: 25, width: 1440, height: 875 },
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
  it('boots the Electron app and creates the floating-hint BrowserWindow', async () => {
    browserWindowMock.mockClear();
    appMock.whenReady.mockClear();
    appMock.on.mockClear();

    await import('../src/main/index.js');
    // Allow whenReady().then(...) microtasks to run.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(appMock.whenReady).toHaveBeenCalled();
    expect(browserWindowMock).toHaveBeenCalledTimes(1);

    const opts = browserWindowMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(opts).toBeTruthy();
    expect(opts.alwaysOnTop).toBe(true);
    expect(opts.frame).toBe(false);
    expect(opts.transparent).toBe(true);
    expect(opts.backgroundColor).toBe('#00000000');
    expect(opts.focusable).toBe(false);
    expect(opts.width).toBe(360);
    expect(opts.height).toBe(200);

    const winInstance = browserWindowMock.mock.results[0]?.value as {
      setAlwaysOnTop: ReturnType<typeof vi.fn>;
      loadFile: ReturnType<typeof vi.fn>;
    };
    expect(winInstance.setAlwaysOnTop).toHaveBeenCalledWith(true, 'floating');
    expect(winInstance.loadFile).toHaveBeenCalled();
  });
});
