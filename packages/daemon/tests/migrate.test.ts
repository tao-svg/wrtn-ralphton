import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';

const REQUIRED_TABLES = [
  'profile',
  'item_states',
  'vision_calls',
  'rate_limit_buckets',
  'vision_cache',
  'consents',
  'schema_migrations',
] as const;

const REQUIRED_INDEXES = [
  'idx_vision_calls_item',
  'idx_vision_calls_created',
  'idx_vision_cache_ttl',
] as const;

describe('migrate', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-daemon-test-'));
    dbPath = join(tmpDir, 'agent.db');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates all PRD §8.1 tables on first run', () => {
    const db = openDatabase(dbPath);
    try {
      const result = migrate(db);
      expect(result.applied.length).toBeGreaterThan(0);
      expect(result.skipped).toEqual([]);

      const rows = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>;
      const tables = new Set(rows.map((r) => r.name));
      for (const t of REQUIRED_TABLES) {
        expect(tables.has(t), `expected table ${t}`).toBe(true);
      }
    } finally {
      db.close();
    }
  });

  it('creates all PRD §8.1 indexes on first run', () => {
    const db = openDatabase(dbPath);
    try {
      migrate(db);
      const rows = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index'")
        .all() as Array<{ name: string }>;
      const indexes = new Set(rows.map((r) => r.name));
      for (const idx of REQUIRED_INDEXES) {
        expect(indexes.has(idx), `expected index ${idx}`).toBe(true);
      }
    } finally {
      db.close();
    }
  });

  it('is idempotent: a second run applies nothing and skips already-applied versions', () => {
    const db = openDatabase(dbPath);
    try {
      const first = migrate(db);
      expect(first.applied.length).toBeGreaterThan(0);

      const second = migrate(db);
      expect(second.applied).toEqual([]);
      expect(second.skipped.length).toBe(first.applied.length);
      expect(second.skipped).toEqual(first.applied);
    } finally {
      db.close();
    }
  });

  it('records applied migrations in schema_migrations', () => {
    const db = openDatabase(dbPath);
    try {
      const { applied } = migrate(db);
      const rows = db
        .prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version')
        .all() as Array<{ version: string; applied_at: number }>;
      expect(rows.map((r) => r.version)).toEqual([...applied].sort());
      for (const row of rows) {
        expect(row.applied_at).toBeGreaterThan(0);
      }
    } finally {
      db.close();
    }
  });

  it('opens with WAL journal mode enabled', () => {
    const db = openDatabase(dbPath);
    try {
      const mode = db.pragma('journal_mode', { simple: true });
      expect(String(mode).toLowerCase()).toBe('wal');
    } finally {
      db.close();
    }
  });

  it('creates parent directories that do not yet exist', () => {
    const nested = join(tmpDir, 'deep', 'nested', 'path', 'agent.db');
    const db = openDatabase(nested);
    try {
      expect(() => migrate(db)).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('enforces item_states.status CHECK constraint', () => {
    const db = openDatabase(dbPath);
    try {
      migrate(db);
      const insertBad = (): void => {
        db.prepare(
          "INSERT INTO item_states (item_id, status) VALUES ('x', 'not_a_real_status')",
        ).run();
      };
      expect(insertBad).toThrow();
    } finally {
      db.close();
    }
  });
});
