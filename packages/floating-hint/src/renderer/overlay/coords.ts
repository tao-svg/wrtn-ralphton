// Coordinate transform for the highlight-region overlay.
//
// Vision pipeline:
//   1. Daemon captures the screen (physical px = display.width × scaleFactor).
//   2. sharp resizes it so the long edge is `VISION_LONG_EDGE_PX` (1568) — the
//      Anthropic-recommended size that keeps OCR quality high while staying
//      under the API's pixel budget.
//   3. Claude Vision returns `highlight_region` coordinates in that resized
//      image space.
//
// The overlay window covers the work area in CSS pixels (Electron positions
// child elements in CSS px). To draw the box on the right spot we have to
// undo step 2 (upscale to physical) and then convert physical → CSS. Both
// corrections matter on Retina (PRD §10 AC-VIS-09 and spec-016 AC).

import type { HighlightRegion } from '@onboarding/shared';

export const VISION_LONG_EDGE_PX = 1568;

export interface DisplayMetrics {
  /** Work-area width in CSS pixels (e.g. `screen.getPrimaryDisplay().workArea.width`). */
  width: number;
  /** Work-area height in CSS pixels. */
  height: number;
  /** Physical-to-CSS ratio (`screen.getPrimaryDisplay().scaleFactor`). 2 on Retina. */
  scaleFactor: number;
}

export interface CssRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function isValidRegion(value: unknown): value is HighlightRegion {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  const fields = [r.x, r.y, r.width, r.height];
  if (!fields.every((f) => typeof f === 'number' && Number.isFinite(f))) {
    return false;
  }
  if ((r.x as number) < 0 || (r.y as number) < 0) return false;
  if ((r.width as number) <= 0 || (r.height as number) <= 0) return false;
  return true;
}

export function visionRegionToCss(
  region: HighlightRegion | null | undefined,
  display: DisplayMetrics,
): CssRect | null {
  if (!isValidRegion(region)) return null;
  const physicalLongEdge =
    Math.max(display.width, display.height) * display.scaleFactor;
  const upscale =
    physicalLongEdge > VISION_LONG_EDGE_PX
      ? physicalLongEdge / VISION_LONG_EDGE_PX
      : 1;
  // ratio = (vision → physical) × (physical → CSS) = upscale / scaleFactor.
  const ratio = upscale / display.scaleFactor;
  return {
    left: region.x * ratio,
    top: region.y * ratio,
    width: region.width * ratio,
    height: region.height * ratio,
  };
}
