// PRD §7.7 F-P8-06 — 1초 debounce per (item, step, imageHash) key.
export const DEBOUNCE_WINDOW_MS = 1000;

export class DebounceError extends Error {
  readonly code = 'debounce_throttled';
  constructor(message = 'debounce_throttled') {
    super(message);
    this.name = 'DebounceError';
  }
}

export interface VisionDebounceDeps {
  now?: () => number;
  windowMs?: number;
}

export interface VisionDebounce {
  check(key: string): void;
}

export function createVisionDebounce(
  deps: VisionDebounceDeps = {},
): VisionDebounce {
  const now = deps.now ?? Date.now;
  const windowMs = deps.windowMs ?? DEBOUNCE_WINDOW_MS;
  const lastCalled = new Map<string, number>();

  return {
    check(key: string): void {
      const t = now();
      const last = lastCalled.get(key);
      if (last !== undefined && t - last < windowMs) {
        throw new DebounceError();
      }
      lastCalled.set(key, t);
    },
  };
}
