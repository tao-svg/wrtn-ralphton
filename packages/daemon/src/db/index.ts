import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import Database, { type Database as DatabaseInstance } from 'better-sqlite3';

export function defaultDbPath(): string {
  return join(homedir(), '.onboarding', 'agent.db');
}

export function openDatabase(dbPath: string): DatabaseInstance {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export type { DatabaseInstance };
