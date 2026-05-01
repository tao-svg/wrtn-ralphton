import { describe, expect, it, vi } from 'vitest';

import { checkScreenRecordingPermission } from '../src/system/screen-recording.js';

describe('checkScreenRecordingPermission', () => {
  it('reports unsupported_platform on non-darwin platforms', () => {
    vi.stubGlobal('process', { ...process, platform: 'linux' });
    try {
      const result = checkScreenRecordingPermission();
      expect(result.supported).toBe(false);
      expect(result.reason).toBe('unsupported_platform');
      expect(result.granted).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports supported on darwin (granted is null until SPEC-009 wires native binding)', () => {
    vi.stubGlobal('process', { ...process, platform: 'darwin' });
    try {
      const result = checkScreenRecordingPermission();
      expect(result.supported).toBe(true);
      expect(result.reason).toBeUndefined();
      // SPEC-009 will plug in CGPreflightScreenCaptureAccess; for now granted is null.
      expect(result.granted).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
