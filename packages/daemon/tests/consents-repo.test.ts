import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createConsentsRepository } from '../src/consents/repository.js';
import { openDatabase, type DatabaseInstance } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';

describe('consents repository', () => {
  let tmpDir: string;
  let db: DatabaseInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-consents-repo-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getAll', () => {
    it('returns default not-granted records when no rows exist', () => {
      const repo = createConsentsRepository(db);
      const all = repo.getAll();
      expect(all).toEqual({
        screen_recording: {
          consent_type: 'screen_recording',
          granted: false,
          granted_at: null,
          revoked_at: null,
        },
        anthropic_transmission: {
          consent_type: 'anthropic_transmission',
          granted: false,
          granted_at: null,
          revoked_at: null,
        },
      });
    });

    it('reflects rows persisted in SQLite', () => {
      const repo = createConsentsRepository(db);
      repo.upsert('screen_recording', true, 1_000);
      repo.upsert('anthropic_transmission', true, 2_000);
      const all = repo.getAll();
      expect(all.screen_recording.granted).toBe(true);
      expect(all.screen_recording.granted_at).toBe(1_000);
      expect(all.anthropic_transmission.granted).toBe(true);
      expect(all.anthropic_transmission.granted_at).toBe(2_000);
    });
  });

  describe('upsert', () => {
    it('inserts a granted row with granted_at = now and null revoked_at', () => {
      const repo = createConsentsRepository(db);
      repo.upsert('anthropic_transmission', true, 12_345);

      const row = db
        .prepare('SELECT * FROM consents WHERE consent_type = ?')
        .get('anthropic_transmission') as {
          consent_type: string;
          granted: number;
          granted_at: number | null;
          revoked_at: number | null;
        };
      expect(row.consent_type).toBe('anthropic_transmission');
      expect(row.granted).toBe(1);
      expect(row.granted_at).toBe(12_345);
      expect(row.revoked_at).toBeNull();
    });

    it('is idempotent — repeated granted=true keeps a single row (PK consent_type)', () => {
      const repo = createConsentsRepository(db);
      repo.upsert('screen_recording', true, 100);
      repo.upsert('screen_recording', true, 200);
      repo.upsert('screen_recording', true, 300);

      const count = db
        .prepare('SELECT COUNT(*) AS c FROM consents WHERE consent_type = ?')
        .get('screen_recording') as { c: number };
      expect(count.c).toBe(1);

      const row = db
        .prepare('SELECT * FROM consents WHERE consent_type = ?')
        .get('screen_recording') as { granted_at: number };
      // Latest granted_at wins (re-grant refreshes timestamp)
      expect(row.granted_at).toBe(300);
    });

    it('preserves granted_at and sets revoked_at when revoking (granted=false)', () => {
      const repo = createConsentsRepository(db);
      repo.upsert('anthropic_transmission', true, 1_000);
      repo.upsert('anthropic_transmission', false, 5_000);

      const row = db
        .prepare('SELECT * FROM consents WHERE consent_type = ?')
        .get('anthropic_transmission') as {
          granted: number;
          granted_at: number | null;
          revoked_at: number | null;
        };
      expect(row.granted).toBe(0);
      expect(row.granted_at).toBe(1_000);
      expect(row.revoked_at).toBe(5_000);
    });

    it('clears revoked_at when re-granting after revoke', () => {
      const repo = createConsentsRepository(db);
      repo.upsert('anthropic_transmission', true, 1_000);
      repo.upsert('anthropic_transmission', false, 2_000);
      repo.upsert('anthropic_transmission', true, 3_000);

      const row = db
        .prepare('SELECT * FROM consents WHERE consent_type = ?')
        .get('anthropic_transmission') as {
          granted: number;
          granted_at: number | null;
          revoked_at: number | null;
        };
      expect(row.granted).toBe(1);
      expect(row.granted_at).toBe(3_000);
      expect(row.revoked_at).toBeNull();
    });

    it('allows revoke without prior grant (no row → revoked_at row, granted_at=null)', () => {
      const repo = createConsentsRepository(db);
      repo.upsert('anthropic_transmission', false, 7_000);

      const row = db
        .prepare('SELECT * FROM consents WHERE consent_type = ?')
        .get('anthropic_transmission') as {
          granted: number;
          granted_at: number | null;
          revoked_at: number | null;
        };
      expect(row.granted).toBe(0);
      expect(row.granted_at).toBeNull();
      expect(row.revoked_at).toBe(7_000);
    });

    it('rejects invalid consent_type via SQLite CHECK constraint', () => {
      const repo = createConsentsRepository(db);
      // @ts-expect-error — runtime guard, type system also rejects
      expect(() => repo.upsert('bogus_consent', true, 1)).toThrow();
    });
  });
});
