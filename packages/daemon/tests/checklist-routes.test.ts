import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ChecklistFile } from '@onboarding/shared';
import pino from 'pino';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  openDatabase,
  type DatabaseInstance,
} from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { registerApiRoutes } from '../src/routes/index.js';
import { createServer } from '../src/server.js';

const silentLogger = pino({ level: 'silent' });

const FIXTURE_CHECKLIST: ChecklistFile = {
  version: 2,
  schema: 'ai-coaching',
  items: [
    {
      id: 'install-homebrew',
      title: 'Homebrew 설치',
      estimated_minutes: 3,
      clipboard_inject: {
        command: 'brew install something',
        ui_hint: '터미널에 ⌘V',
      },
      verification: {
        type: 'command',
        command: 'brew --version',
      },
    },
    {
      id: 'configure-git',
      title: 'Git 설정',
      estimated_minutes: 1,
    },
  ],
};

function buildApp(checklist: ChecklistFile, db: DatabaseInstance, now = Date.now) {
  return createServer({
    logger: silentLogger,
    registerRoutes: (app) => {
      registerApiRoutes(app, { checklist, db, now });
    },
  });
}

describe('checklist routes', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-checklist-routes-'));
    dbPath = join(tmpDir, 'agent.db');
    db = openDatabase(dbPath);
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/checklist', () => {
    it('returns all yaml items merged with state, defaulting to pending when no row exists', async () => {
      const app = buildApp(FIXTURE_CHECKLIST, db);
      const res = await request(app).get('/api/checklist');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items).toHaveLength(2);

      const homebrew = res.body.items[0];
      expect(homebrew.item_id).toBe('install-homebrew');
      expect(homebrew.title).toBe('Homebrew 설치');
      expect(homebrew.status).toBe('pending');
      expect(homebrew.current_step).toBeNull();
      expect(homebrew.started_at).toBeNull();
      expect(homebrew.completed_at).toBeNull();
      expect(homebrew.attempt_count).toBe(0);

      const git = res.body.items[1];
      expect(git.item_id).toBe('configure-git');
      expect(git.title).toBe('Git 설정');
      expect(git.status).toBe('pending');
    });

    it('reflects existing item_states rows from SQLite', async () => {
      db.prepare(
        `INSERT INTO item_states
           (item_id, status, current_step, started_at, completed_at, attempt_count)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('install-homebrew', 'in_progress', 'step-1', 1000, null, 1);

      const app = buildApp(FIXTURE_CHECKLIST, db);
      const res = await request(app).get('/api/checklist');
      expect(res.status).toBe(200);
      const homebrew = res.body.items.find(
        (i: { item_id: string }) => i.item_id === 'install-homebrew',
      );
      expect(homebrew).toMatchObject({
        item_id: 'install-homebrew',
        title: 'Homebrew 설치',
        status: 'in_progress',
        current_step: 'step-1',
        started_at: 1000,
        completed_at: null,
        attempt_count: 1,
      });
    });

    it('preserves yaml item order in the response', async () => {
      const app = buildApp(FIXTURE_CHECKLIST, db);
      const res = await request(app).get('/api/checklist');
      expect(res.body.items.map((i: { item_id: string }) => i.item_id)).toEqual([
        'install-homebrew',
        'configure-git',
      ]);
    });
  });

  describe('POST /api/items/:itemId/start', () => {
    it('inserts a new in_progress row with started_at and attempt_count=1', async () => {
      const fixedNow = 1_700_000_000_000;
      const app = buildApp(FIXTURE_CHECKLIST, db, () => fixedNow);
      const res = await request(app).post('/api/items/install-homebrew/start');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });

      const row = db
        .prepare('SELECT * FROM item_states WHERE item_id = ?')
        .get('install-homebrew') as {
          item_id: string;
          status: string;
          started_at: number | null;
          completed_at: number | null;
          attempt_count: number;
        };
      expect(row.status).toBe('in_progress');
      expect(row.started_at).toBe(fixedNow);
      expect(row.completed_at).toBeNull();
      expect(row.attempt_count).toBe(1);
    });

    it('increments attempt_count and refreshes started_at on subsequent starts', async () => {
      let now = 1_000;
      const app = buildApp(FIXTURE_CHECKLIST, db, () => now);
      await request(app).post('/api/items/install-homebrew/start').expect(200);
      now = 2_000;
      await request(app).post('/api/items/install-homebrew/start').expect(200);

      const row = db
        .prepare('SELECT * FROM item_states WHERE item_id = ?')
        .get('install-homebrew') as {
          status: string;
          started_at: number | null;
          attempt_count: number;
        };
      expect(row.status).toBe('in_progress');
      expect(row.started_at).toBe(2_000);
      expect(row.attempt_count).toBe(2);
    });

    it('returns 404 with item_not_found error when itemId is unknown', async () => {
      const app = buildApp(FIXTURE_CHECKLIST, db);
      const res = await request(app).post('/api/items/does-not-exist/start');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'item_not_found' });
    });

    it('does not insert a row when item is unknown', async () => {
      const app = buildApp(FIXTURE_CHECKLIST, db);
      await request(app).post('/api/items/nope/start');
      const row = db
        .prepare('SELECT * FROM item_states WHERE item_id = ?')
        .get('nope');
      expect(row).toBeUndefined();
    });

    it('after start, GET /api/checklist reflects in_progress state', async () => {
      const fixedNow = 5_555;
      const app = buildApp(FIXTURE_CHECKLIST, db, () => fixedNow);
      await request(app).post('/api/items/install-homebrew/start').expect(200);
      const res = await request(app).get('/api/checklist');
      const homebrew = res.body.items.find(
        (i: { item_id: string }) => i.item_id === 'install-homebrew',
      );
      expect(homebrew.status).toBe('in_progress');
      expect(homebrew.started_at).toBe(fixedNow);
      expect(homebrew.attempt_count).toBe(1);
    });
  });
});
