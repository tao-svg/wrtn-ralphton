import { describe, it, expect, vi } from 'vitest';
import {
  HINT_WINDOW_HEIGHT,
  HINT_WINDOW_MARGIN,
  HINT_WINDOW_WIDTH,
  assertSupportedPlatform,
  buildBrowserWindowOptions,
  calculatePosition,
} from '../src/main/window-options.js';

describe('calculatePosition', () => {
  it('places the window at the bottom-right with a 16px margin', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
    const pos = calculatePosition(workArea);
    expect(pos.x).toBe(1920 - HINT_WINDOW_WIDTH - HINT_WINDOW_MARGIN);
    expect(pos.y).toBe(1080 - HINT_WINDOW_HEIGHT - HINT_WINDOW_MARGIN);
  });

  it('respects a non-zero work-area origin (e.g. macOS menu bar offset)', () => {
    const workArea = { x: 0, y: 25, width: 1440, height: 875 };
    const pos = calculatePosition(workArea);
    expect(pos.x).toBe(0 + 1440 - HINT_WINDOW_WIDTH - HINT_WINDOW_MARGIN);
    expect(pos.y).toBe(25 + 875 - HINT_WINDOW_HEIGHT - HINT_WINDOW_MARGIN);
  });

  it('accepts custom width / height / margin overrides', () => {
    const workArea = { x: 0, y: 0, width: 1000, height: 800 };
    const pos = calculatePosition(workArea, 200, 100, 8);
    expect(pos.x).toBe(1000 - 200 - 8);
    expect(pos.y).toBe(800 - 100 - 8);
  });
});

describe('buildBrowserWindowOptions', () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
  const opts = buildBrowserWindowOptions(workArea, '/path/to/preload.js');

  it('sets the F-P5PP-01 window flags (always-on-top, transparent, focusable=false)', () => {
    expect(opts.alwaysOnTop).toBe(true);
    expect(opts.frame).toBe(false);
    expect(opts.transparent).toBe(true);
    expect(opts.backgroundColor).toBe('#00000000');
    expect(opts.focusable).toBe(false);
  });

  it('uses the PRD §5 sizing (360 × 200) and primary-display bottom-right placement', () => {
    expect(opts.width).toBe(360);
    expect(opts.height).toBe(200);
    expect(opts.x).toBe(1920 - 360 - 16);
    expect(opts.y).toBe(1080 - 200 - 16);
  });

  it('locks down the renderer with contextIsolation=true and nodeIntegration=false', () => {
    expect(opts.webPreferences?.contextIsolation).toBe(true);
    expect(opts.webPreferences?.nodeIntegration).toBe(false);
    expect(opts.webPreferences?.sandbox).toBe(true);
    expect(opts.webPreferences?.preload).toBe('/path/to/preload.js');
  });

  it('disables window decorations that would interfere with overlay use', () => {
    expect(opts.resizable).toBe(false);
    expect(opts.minimizable).toBe(false);
    expect(opts.maximizable).toBe(false);
    expect(opts.skipTaskbar).toBe(true);
    expect(opts.show).toBe(false);
  });
});

describe('assertSupportedPlatform', () => {
  it('does nothing on darwin', () => {
    const exit = vi.fn() as unknown as (code: number) => never;
    const log = vi.fn();
    assertSupportedPlatform('darwin', exit, log);
    expect(exit).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('logs a guidance message and exits with code 1 on non-darwin platforms', () => {
    const exit = vi.fn() as unknown as (code: number) => never;
    const log = vi.fn();
    assertSupportedPlatform('linux', exit, log);
    expect(exit).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledTimes(1);
    const message = log.mock.calls[0]?.[0] as string;
    expect(message).toMatch(/macOS/);
    expect(message).toMatch(/linux/);
  });

  it('also rejects win32', () => {
    const exit = vi.fn() as unknown as (code: number) => never;
    const log = vi.fn();
    assertSupportedPlatform('win32', exit, log);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
