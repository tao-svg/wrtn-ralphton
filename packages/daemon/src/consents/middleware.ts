import type { ConsentType } from '@onboarding/shared';
import type { RequestHandler } from 'express';

import type { DatabaseInstance } from '../db/index.js';
import { createConsentsRepository } from './repository.js';

// PRD §9.1.3 error contracts:
//   401 { "error": "screen_recording_permission_required" }   ← OS-level permission
//   403 { "error": "consent_required", "missing": [...] }      ← user consent
// SR missing wins over the 403 branch — the OS gate must be satisfied first.
export function requireConsent(
  db: DatabaseInstance,
  ...required: ConsentType[]
): RequestHandler {
  const repo = createConsentsRepository(db);
  return (_req, res, next) => {
    if (required.length === 0) {
      next();
      return;
    }

    const missing: ConsentType[] = [];
    let screenRecordingMissing = false;

    for (const type of required) {
      const record = repo.get(type);
      if (!record.granted) {
        if (type === 'screen_recording') {
          screenRecordingMissing = true;
        } else {
          missing.push(type);
        }
      }
    }

    if (screenRecordingMissing) {
      res.status(401).json({ error: 'screen_recording_permission_required' });
      return;
    }
    if (missing.length > 0) {
      res.status(403).json({ error: 'consent_required', missing });
      return;
    }
    next();
  };
}
