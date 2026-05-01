import {
  CONSENT_TYPES,
  type ConsentRecord,
  type ConsentType,
} from '@onboarding/shared';

import type { DatabaseInstance } from '../db/index.js';

interface ConsentRow {
  consent_type: ConsentType;
  granted: number;
  granted_at: number | null;
  revoked_at: number | null;
}

export type ConsentsMap = {
  [K in ConsentType]: ConsentRecord;
};

export interface ConsentsRepository {
  getAll(): ConsentsMap;
  get(type: ConsentType): ConsentRecord;
  upsert(type: ConsentType, granted: boolean, now: number): void;
}

export function createConsentsRepository(
  db: DatabaseInstance,
): ConsentsRepository {
  const selectStmt = db.prepare(
    `SELECT consent_type, granted, granted_at, revoked_at
       FROM consents
      WHERE consent_type = ?`,
  );

  // granted=true → set granted_at to now, clear revoked_at.
  const grantStmt = db.prepare(
    `INSERT INTO consents (consent_type, granted, granted_at, revoked_at)
     VALUES (@type, 1, @now, NULL)
     ON CONFLICT(consent_type) DO UPDATE SET
       granted     = 1,
       granted_at  = @now,
       revoked_at  = NULL`,
  );

  // granted=false → preserve existing granted_at, set revoked_at to now.
  const revokeStmt = db.prepare(
    `INSERT INTO consents (consent_type, granted, granted_at, revoked_at)
     VALUES (@type, 0, NULL, @now)
     ON CONFLICT(consent_type) DO UPDATE SET
       granted    = 0,
       revoked_at = @now`,
  );

  function rowToRecord(type: ConsentType, row: ConsentRow | undefined): ConsentRecord {
    if (!row) {
      return {
        consent_type: type,
        granted: false,
        granted_at: null,
        revoked_at: null,
      };
    }
    return {
      consent_type: row.consent_type,
      granted: row.granted === 1,
      granted_at: row.granted_at,
      revoked_at: row.revoked_at,
    };
  }

  return {
    getAll() {
      const map = {} as ConsentsMap;
      for (const type of CONSENT_TYPES) {
        const row = selectStmt.get(type) as ConsentRow | undefined;
        map[type] = rowToRecord(type, row);
      }
      return map;
    },

    get(type) {
      const row = selectStmt.get(type) as ConsentRow | undefined;
      return rowToRecord(type, row);
    },

    upsert(type, granted, now) {
      if (granted) {
        grantStmt.run({ type, now });
      } else {
        revokeStmt.run({ type, now });
      }
    },
  };
}
