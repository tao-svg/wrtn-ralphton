import { describe, it, expect } from 'vitest';
import {
  VISION_LONG_EDGE_PX,
  isValidRegion,
  visionRegionToCss,
} from '../../src/renderer/overlay/coords.js';

describe('VISION_LONG_EDGE_PX', () => {
  it('matches the Anthropic recommended long-edge resize (1568px)', () => {
    expect(VISION_LONG_EDGE_PX).toBe(1568);
  });
});

describe('isValidRegion', () => {
  it('accepts a positive box at the origin', () => {
    expect(isValidRegion({ x: 0, y: 0, width: 32, height: 32 })).toBe(true);
  });

  it('rejects null / undefined', () => {
    expect(isValidRegion(null)).toBe(false);
    expect(isValidRegion(undefined)).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isValidRegion('not a region')).toBe(false);
    expect(isValidRegion(42)).toBe(false);
  });

  it('rejects missing or non-numeric fields', () => {
    expect(isValidRegion({ x: 0, y: 0, width: 10 })).toBe(false);
    expect(isValidRegion({ x: '0', y: 0, width: 10, height: 10 })).toBe(false);
  });

  it('rejects negative origin', () => {
    expect(isValidRegion({ x: -1, y: 0, width: 10, height: 10 })).toBe(false);
    expect(isValidRegion({ x: 0, y: -1, width: 10, height: 10 })).toBe(false);
  });

  it('rejects zero or negative dimensions', () => {
    expect(isValidRegion({ x: 0, y: 0, width: 0, height: 10 })).toBe(false);
    expect(isValidRegion({ x: 0, y: 0, width: 10, height: 0 })).toBe(false);
    expect(isValidRegion({ x: 0, y: 0, width: -5, height: 10 })).toBe(false);
  });

  it('rejects non-finite values (NaN, Infinity)', () => {
    expect(isValidRegion({ x: NaN, y: 0, width: 10, height: 10 })).toBe(false);
    expect(isValidRegion({ x: 0, y: 0, width: Infinity, height: 10 })).toBe(false);
  });
});

describe('visionRegionToCss', () => {
  // Spec: capture is sharp-resized to long-edge 1568px before sending to Vision.
  // Display info comes from Electron's screen.getPrimaryDisplay() (CSS work
  // area + scaleFactor). Output is in CSS px so the renderer can position the
  // box with `left: ...px`.

  it('1568-space center maps to physical 2880x1800 Retina center (≤5px error)', () => {
    // 14" Retina: 1440x900 CSS @ scaleFactor 2 → physical 2880x1800.
    // sharp resize 2880 → 1568, so vision sees a 1568x980 image.
    // Box centered on vision (784, 490) — i.e. vision top-left (768, 474) —
    // should land centered on CSS (720, 450) ± 5 px.
    const result = visionRegionToCss(
      { x: 768, y: 474, width: 32, height: 32 },
      { width: 1440, height: 900, scaleFactor: 2 },
    );
    expect(result).not.toBeNull();
    if (!result) return;
    const centerX = result.left + result.width / 2;
    const centerY = result.top + result.height / 2;
    expect(Math.abs(centerX - 720)).toBeLessThanOrEqual(5);
    expect(Math.abs(centerY - 450)).toBeLessThanOrEqual(5);
  });

  it('vision (0,0) maps to display (0,0) regardless of scale', () => {
    const result = visionRegionToCss(
      { x: 0, y: 0, width: 32, height: 32 },
      { width: 1440, height: 900, scaleFactor: 2 },
    );
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.left).toBeCloseTo(0, 1);
    expect(result.top).toBeCloseTo(0, 1);
  });

  it('full vision space (1568x980) covers the full 1440x900 CSS display', () => {
    const result = visionRegionToCss(
      { x: 0, y: 0, width: 1568, height: 980 },
      { width: 1440, height: 900, scaleFactor: 2 },
    );
    expect(result).not.toBeNull();
    if (!result) return;
    expect(Math.abs(result.width - 1440)).toBeLessThanOrEqual(5);
    expect(Math.abs(result.height - 900)).toBeLessThanOrEqual(5);
  });

  it('non-Retina 1920x1080 with scaleFactor 1 upscales by 1920/1568', () => {
    const result = visionRegionToCss(
      { x: 0, y: 0, width: 1568, height: 882 }, // long-edge resize keeps 16:9
      { width: 1920, height: 1080, scaleFactor: 1 },
    );
    expect(result).not.toBeNull();
    if (!result) return;
    expect(Math.abs(result.width - 1920)).toBeLessThanOrEqual(5);
  });

  it('display whose long-edge is below 1568 is not upscaled', () => {
    // 1280x800 @ scaleFactor 1 → physical long-edge 1280 < 1568.
    // sharp would skip the resize, so vision coords already equal physical px.
    const result = visionRegionToCss(
      { x: 100, y: 100, width: 50, height: 50 },
      { width: 1280, height: 800, scaleFactor: 1 },
    );
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.left).toBeCloseTo(100, 1);
    expect(result.top).toBeCloseTo(100, 1);
    expect(result.width).toBeCloseTo(50, 1);
    expect(result.height).toBeCloseTo(50, 1);
  });

  it('returns null for null / invalid regions', () => {
    expect(
      visionRegionToCss(null, { width: 1440, height: 900, scaleFactor: 2 }),
    ).toBeNull();
    expect(
      visionRegionToCss(undefined, {
        width: 1440,
        height: 900,
        scaleFactor: 2,
      }),
    ).toBeNull();
    expect(
      visionRegionToCss(
        { x: -1, y: 0, width: 10, height: 10 },
        { width: 1440, height: 900, scaleFactor: 2 },
      ),
    ).toBeNull();
    expect(
      visionRegionToCss(
        { x: 0, y: 0, width: 0, height: 10 },
        { width: 1440, height: 900, scaleFactor: 2 },
      ),
    ).toBeNull();
  });

  it('handles portrait-oriented displays (long-edge is height)', () => {
    // 900x1440 portrait Retina → physical 1800x2880, long-edge 2880.
    // Box centered at vision (490, 784) — top-left (474, 768) — should land
    // centered at CSS (450, 720).
    const result = visionRegionToCss(
      { x: 474, y: 768, width: 32, height: 32 },
      { width: 900, height: 1440, scaleFactor: 2 },
    );
    expect(result).not.toBeNull();
    if (!result) return;
    const centerY = result.top + result.height / 2;
    expect(Math.abs(centerY - 720)).toBeLessThanOrEqual(5);
  });

  it('preserves region shape — width/height ratio is unchanged', () => {
    const result = visionRegionToCss(
      { x: 100, y: 100, width: 60, height: 30 },
      { width: 1440, height: 900, scaleFactor: 2 },
    );
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.width / result.height).toBeCloseTo(2, 2);
  });
});
