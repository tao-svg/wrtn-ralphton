import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Database as DatabaseInstance } from 'better-sqlite3';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MIGRATIONS_DIR = join(HERE, 'migrations');

export interface MigrateOptions {
  migrationsDir?: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export function migrate(
  db: DatabaseInstance,
  options: MigrateOptions = {},
): MigrationResult {
  const dir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const rows = db
    .prepare('SELECT version FROM schema_migrations')
    .all() as Array<{ version: string }>;
  const alreadyApplied = new Set(rows.map((r) => r.version));

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const result: MigrationResult = { applied: [], skipped: [] };

  for (const file of files) {
    if (alreadyApplied.has(file)) {
      result.skipped.push(file);
      continue;
    }
    const sql = readFileSync(join(dir, file), 'utf-8');
    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      ).run(file, Date.now());
    });
    apply();
    result.applied.push(file);
  }

  return result;
}
