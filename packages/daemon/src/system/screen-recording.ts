// macOS Screen Recording permission check (PRD §7.7 F-P8-08, AC-CORE-01).
// Real CGPreflightScreenCaptureAccess invocation requires a Node native binding
// which is intentionally deferred to SPEC-009. This module exposes the wrapper
// surface so the daemon and CLI can already branch on platform support.

export type ScreenRecordingCheckReason = 'unsupported_platform';

export interface ScreenRecordingCheck {
  supported: boolean;
  granted: boolean | null;
  reason?: ScreenRecordingCheckReason;
}

export function checkScreenRecordingPermission(): ScreenRecordingCheck {
  if (process.platform !== 'darwin') {
    return {
      supported: false,
      granted: null,
      reason: 'unsupported_platform',
    };
  }
  // SPEC-009 wires the native CGPreflightScreenCaptureAccess call here.
  return { supported: true, granted: null };
}
