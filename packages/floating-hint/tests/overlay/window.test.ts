import { describe, it, expect, vi } from 'vitest';
import {
  buildOverlayWindowOptions,
  createOverlayWindow,
  registerOverlayIpc,
  type OverlayBrowserWindowLike,
} from '../../src/main/overlay-window.js';

describe('buildOverlayWindowOptions', () => {
  const workArea = { x: 0, y: 0, width: 1440, height: 900 };
  const opts = buildOverlayWindowOptions(workArea, '/path/to/overlay-preload.js');

  it('produces a transparent / always-on-top / focusable=false options bag', () => {
    expect(opts.transparent).toBe(true);
    expect(opts.frame).toBe(false);
    expect(opts.alwaysOnTop).toBe(true);
    expect(opts.focusable).toBe(false);
    expect(opts.hasShadow).toBe(false);
  });

  it('covers the entire work area (full-viewport) and starts hidden', () => {
    expect(opts.x).toBe(0);
    expect(opts.y).toBe(0);
    expect(opts.width).toBe(1440);
    expect(opts.height).toBe(900);
    expect(opts.show).toBe(false);
  });

  it('disables window decorations and taskbar entry', () => {
    expect(opts.resizable).toBe(false);
    expect(opts.movable).toBe(false);
    expect(opts.minimizable).toBe(false);
    expect(opts.maximizable).toBe(false);
    expect(opts.skipTaskbar).toBe(true);
  });

  it('locks down the renderer (contextIsolation, sandbox, no nodeIntegration)', () => {
    expect(opts.webPreferences?.contextIsolation).toBe(true);
    expect(opts.webPreferences?.nodeIntegration).toBe(false);
    expect(opts.webPreferences?.sandbox).toBe(true);
    expect(opts.webPreferences?.preload).toBe('/path/to/overlay-preload.js');
  });

  it('respects a non-zero work area origin (e.g. menu bar offset)', () => {
    const o = buildOverlayWindowOptions(
      { x: 0, y: 25, width: 1440, height: 875 },
      '/p.js',
    );
    expect(o.y).toBe(25);
    expect(o.height).toBe(875);
  });
});

describe('createOverlayWindow', () => {
  function mockInstance(): {
    win: OverlayBrowserWindowLike;
    setAlwaysOnTop: ReturnType<typeof vi.fn>;
    setIgnoreMouseEvents: ReturnType<typeof vi.fn>;
    setVisibleOnAllWorkspaces: ReturnType<typeof vi.fn>;
    loadFile: ReturnType<typeof vi.fn>;
  } {
    const setAlwaysOnTop = vi.fn();
    const setIgnoreMouseEvents = vi.fn();
    const setVisibleOnAllWorkspaces = vi.fn();
    const loadFile = vi.fn().mockResolvedValue(undefined);
    const win: OverlayBrowserWindowLike = {
      setAlwaysOnTop,
      setIgnoreMouseEvents,
      setVisibleOnAllWorkspaces,
      loadFile,
      show: vi.fn(),
      hide: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: { send: vi.fn() },
    };
    return { win, setAlwaysOnTop, setIgnoreMouseEvents, setVisibleOnAllWorkspaces, loadFile };
  }

  it('uses BrowserWindow constructor with the overlay options', () => {
    const inst = mockInstance();
    const ctor = vi.fn().mockReturnValue(inst.win);
    createOverlayWindow(ctor as never, {
      workArea: { x: 0, y: 0, width: 1440, height: 900 },
      preloadPath: '/p.js',
      htmlPath: '/h.html',
    });
    expect(ctor).toHaveBeenCalledTimes(1);
    const opts = ctor.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(opts.transparent).toBe(true);
    expect(opts.focusable).toBe(false);
  });

  it('sets always-on-top with screen-saver level (above floating windows)', () => {
    const inst = mockInstance();
    const ctor = vi.fn().mockReturnValue(inst.win);
    createOverlayWindow(ctor as never, {
      workArea: { x: 0, y: 0, width: 1440, height: 900 },
      preloadPath: '/p.js',
      htmlPath: '/h.html',
    });
    expect(inst.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
  });

  it('enables click-through with setIgnoreMouseEvents(true, {forward:true})', () => {
    const inst = mockInstance();
    const ctor = vi.fn().mockReturnValue(inst.win);
    createOverlayWindow(ctor as never, {
      workArea: { x: 0, y: 0, width: 1440, height: 900 },
      preloadPath: '/p.js',
      htmlPath: '/h.html',
    });
    expect(inst.setIgnoreMouseEvents).toHaveBeenCalledWith(true, {
      forward: true,
    });
  });

  it('makes the window visible across spaces / fullscreen', () => {
    const inst = mockInstance();
    const ctor = vi.fn().mockReturnValue(inst.win);
    createOverlayWindow(ctor as never, {
      workArea: { x: 0, y: 0, width: 1440, height: 900 },
      preloadPath: '/p.js',
      htmlPath: '/h.html',
    });
    expect(inst.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, {
      visibleOnFullScreen: true,
    });
  });

  it('loads the overlay HTML file', () => {
    const inst = mockInstance();
    const ctor = vi.fn().mockReturnValue(inst.win);
    createOverlayWindow(ctor as never, {
      workArea: { x: 0, y: 0, width: 1440, height: 900 },
      preloadPath: '/p.js',
      htmlPath: '/abs/overlay.html',
    });
    expect(inst.loadFile).toHaveBeenCalledWith('/abs/overlay.html');
  });
});

describe('registerOverlayIpc', () => {
  function makeIpc(): {
    on: ReturnType<typeof vi.fn>;
    removeAllListeners: ReturnType<typeof vi.fn>;
    fire: (channel: string, ...args: unknown[]) => void;
  } {
    const handlers = new Map<
      string,
      (event: unknown, ...args: unknown[]) => void
    >();
    return {
      on: vi.fn((ch: string, h: (event: unknown, ...args: unknown[]) => void) => {
        handlers.set(ch, h);
      }),
      removeAllListeners: vi.fn((ch: string) => {
        handlers.delete(ch);
      }),
      fire: (ch: string, ...args: unknown[]) => {
        const h = handlers.get(ch);
        if (h) h({}, ...args);
      },
    };
  }

  function makeWindow(): OverlayBrowserWindowLike & {
    webContents: { send: ReturnType<typeof vi.fn> };
    show: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
  } {
    return {
      setAlwaysOnTop: vi.fn(),
      setIgnoreMouseEvents: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      loadFile: vi.fn(),
      webContents: { send: vi.fn() },
      show: vi.fn(),
      hide: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
    };
  }

  const display = { width: 1440, height: 900, scaleFactor: 2 };

  it('registers handlers for overlay:show and overlay:hide', () => {
    const ipc = makeIpc();
    const win = makeWindow();
    registerOverlayIpc(ipc, () => win, () => display);
    expect(ipc.removeAllListeners).toHaveBeenCalledWith('overlay:show');
    expect(ipc.removeAllListeners).toHaveBeenCalledWith('overlay:hide');
    expect(ipc.on).toHaveBeenCalledWith('overlay:show', expect.any(Function));
    expect(ipc.on).toHaveBeenCalledWith('overlay:hide', expect.any(Function));
  });

  it('overlay:show transforms vision coords into CSS rect and shows the window', () => {
    const ipc = makeIpc();
    const win = makeWindow();
    registerOverlayIpc(ipc, () => win, () => display);
    // Box centered on vision (784, 490) — top-left (768, 474) — should land
    // near the centre of a 1440x900 CSS Retina display.
    ipc.fire('overlay:show', { x: 768, y: 474, width: 32, height: 32 });
    expect(win.webContents.send).toHaveBeenCalledTimes(1);
    const [channel, payload] = win.webContents.send.mock.calls[0] as [
      string,
      { left: number; top: number; width: number; height: number },
    ];
    expect(channel).toBe('overlay:render');
    const cx = payload.left + payload.width / 2;
    const cy = payload.top + payload.height / 2;
    expect(Math.abs(cx - 720)).toBeLessThanOrEqual(5);
    expect(Math.abs(cy - 450)).toBeLessThanOrEqual(5);
    expect(win.show).toHaveBeenCalledTimes(1);
  });

  it('overlay:show is a no-op for invalid (negative / zero) regions', () => {
    const ipc = makeIpc();
    const win = makeWindow();
    registerOverlayIpc(ipc, () => win, () => display);
    ipc.fire('overlay:show', { x: -1, y: 0, width: 10, height: 10 });
    ipc.fire('overlay:show', { x: 0, y: 0, width: 0, height: 0 });
    ipc.fire('overlay:show', null);
    expect(win.webContents.send).not.toHaveBeenCalled();
    expect(win.show).not.toHaveBeenCalled();
  });

  it('overlay:show is a no-op when the overlay window is destroyed', () => {
    const ipc = makeIpc();
    const win = makeWindow();
    win.isDestroyed.mockReturnValue(true);
    registerOverlayIpc(ipc, () => win, () => display);
    ipc.fire('overlay:show', { x: 0, y: 0, width: 10, height: 10 });
    expect(win.webContents.send).not.toHaveBeenCalled();
    expect(win.show).not.toHaveBeenCalled();
  });

  it('overlay:show is a no-op when getOverlay() returns null', () => {
    const ipc = makeIpc();
    registerOverlayIpc(ipc, () => null, () => display);
    expect(() =>
      ipc.fire('overlay:show', { x: 0, y: 0, width: 10, height: 10 }),
    ).not.toThrow();
  });

  it('overlay:hide sends overlay:clear and hides the window', () => {
    const ipc = makeIpc();
    const win = makeWindow();
    registerOverlayIpc(ipc, () => win, () => display);
    ipc.fire('overlay:hide');
    expect(win.webContents.send).toHaveBeenCalledWith('overlay:clear');
    expect(win.hide).toHaveBeenCalledTimes(1);
  });

  it('overlay:hide is a no-op when overlay is missing/destroyed', () => {
    const ipc = makeIpc();
    const win = makeWindow();
    win.isDestroyed.mockReturnValue(true);
    registerOverlayIpc(ipc, () => win, () => display);
    ipc.fire('overlay:hide');
    expect(win.webContents.send).not.toHaveBeenCalled();
    expect(win.hide).not.toHaveBeenCalled();
  });

  it('uses the latest display info on each show (re-evaluates the getter)', () => {
    const ipc = makeIpc();
    const win = makeWindow();
    let scale = 1;
    registerOverlayIpc(ipc, () => win, () => ({
      width: 1920,
      height: 1080,
      scaleFactor: scale,
    }));
    ipc.fire('overlay:show', { x: 0, y: 0, width: 1568, height: 882 });
    const first = win.webContents.send.mock.calls[0]?.[1] as { width: number };
    expect(Math.round(first.width)).toBeCloseTo(1920, 0);
    scale = 2;
    win.webContents.send.mockClear();
    ipc.fire('overlay:show', { x: 0, y: 0, width: 1568, height: 882 });
    const second = win.webContents.send.mock.calls[0]?.[1] as { width: number };
    // physical 3840x2160 → CSS 1920x1080, but upscale 3840/1568 = 2.4490; CSS
    // = vision * upscale / scale = vision * 1.2245. So 1568*1.2245 ≈ 1920.
    expect(Math.round(second.width)).toBeCloseTo(1920, 0);
  });
});
