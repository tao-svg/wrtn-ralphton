export const CONSENT_TYPES = [
  'screen_recording',
  'anthropic_transmission',
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export interface ConsentRecord {
  consent_type: ConsentType;
  granted: boolean;
  granted_at: number | null;
  revoked_at: number | null;
}
