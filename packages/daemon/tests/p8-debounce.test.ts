import { describe, expect, it } from 'vitest';

import {
  DEBOUNCE_WINDOW_MS,
  DebounceError,
  createVisionDebounce,
} from '../src/p8-vision/debounce.js';

describe('p8-vision/debounce — DebounceError', () => {
  it('exposes code "debounce_throttled"', () => {
    const err = new DebounceError();
    expect(err.code).toBe('debounce_throttled');
    expect(err.message).toBe('debounce_throttled');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DebounceError');
  });
});

describe('p8-vision/debounce — window', () => {
  it('exposes 1000ms default window', () => {
    expect(DEBOUNCE_WINDOW_MS).toBe(1000);
  });
});

describe('p8-vision/debounce — check()', () => {
  it('first call for a key passes', () => {
    const debounce = createVisionDebounce({ now: () => 0 });
    expect(() => debounce.check('k')).not.toThrow();
  });

  it('throws DebounceError on a second call within 0.5s', () => {
    let now = 0;
    const debounce = createVisionDebounce({ now: () => now });
    debounce.check('k');
    now = 500;
    expect(() => debounce.check('k')).toThrow(DebounceError);
  });

  it('throws DebounceError on the same-millisecond replay', () => {
    const debounce = createVisionDebounce({ now: () => 100 });
    debounce.check('k');
    expect(() => debounce.check('k')).toThrow(DebounceError);
  });

  it('throws DebounceError just inside the window (999ms later)', () => {
    let now = 0;
    const debounce = createVisionDebounce({ now: () => now });
    debounce.check('k');
    now = 999;
    expect(() => debounce.check('k')).toThrow(DebounceError);
  });

  it('passes after the window elapses (1100ms later)', () => {
    let now = 0;
    const debounce = createVisionDebounce({ now: () => now });
    debounce.check('k');
    now = 1100;
    expect(() => debounce.check('k')).not.toThrow();
  });

  it('passes at exactly 1000ms (boundary inclusive of "elapsed")', () => {
    let now = 0;
    const debounce = createVisionDebounce({ now: () => now });
    debounce.check('k');
    now = 1000;
    expect(() => debounce.check('k')).not.toThrow();
  });

  it('different keys are independent (no cross-key throttling)', () => {
    const debounce = createVisionDebounce({ now: () => 0 });
    debounce.check('k1');
    expect(() => debounce.check('k2')).not.toThrow();
    expect(() => debounce.check('k3')).not.toThrow();
  });

  it('a passing call resets the window for that key', () => {
    let now = 0;
    const debounce = createVisionDebounce({ now: () => now });
    debounce.check('k');
    now = 1100;
    debounce.check('k'); // passes
    now = 1500;
    // Within the new window from 1100, so still throttled
    expect(() => debounce.check('k')).toThrow(DebounceError);
  });

  it('uses Date.now by default', () => {
    const debounce = createVisionDebounce();
    expect(() => debounce.check('default-now')).not.toThrow();
    expect(() => debounce.check('default-now')).toThrow(DebounceError);
  });

  it('honors a custom windowMs', () => {
    let now = 0;
    const debounce = createVisionDebounce({ now: () => now, windowMs: 200 });
    debounce.check('k');
    now = 150;
    expect(() => debounce.check('k')).toThrow(DebounceError);
    now = 250;
    expect(() => debounce.check('k')).not.toThrow();
  });
});
