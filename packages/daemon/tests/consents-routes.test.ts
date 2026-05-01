import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import pino from 'pino';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createConsentsRouter } from '../src/routes/consents.js';
import { openDatabase, type DatabaseInstance } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { createServer } from '../src/server.js';

const silentLogger = pino({ level: 'silent' });

function buildApp(db: DatabaseInstance, now: () => number = Date.now) {
  return createServer({
    logger: silentLogger,
    registerRoutes: (app) => {
      app.use(createConsentsRouter({ db, now }));
    },
  });
}

describe('consents routes', () => {
  let tmpDir: string;
  let db: DatabaseInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-consents-routes-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/consents', () => {
    it('returns default not-granted records for both consent types', async () => {
      const app = buildApp(db);
      const res = await request(app).get('/api/consents');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
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
  });

  describe('POST /api/consents', () => {
    it('persists a granted consent and the GET round-trip reflects it (AC-CORE-02)', async () => {
      const fixedNow = 1_700_000_000_000;
      const app = buildApp(db, () => fixedNow);

      const post = await request(app)
        .post('/api/consents')
        .send({ consent_type: 'anthropic_transmission', granted: true });
      expect(post.status).toBe(200);
      expect(post.body).toEqual({ ok: true });

      const get = await request(app).get('/api/consents');
      expect(get.status).toBe(200);
      expect(get.body.anthropic_transmission).toEqual({
        consent_type: 'anthropic_transmission',
        granted: true,
        granted_at: fixedNow,
        revoked_at: null,
      });
      expect(get.body.screen_recording.granted).toBe(false);
    });

    it('records both consents independently', async () => {
      let now = 100;
      const app = buildApp(db, () => now);
      await request(app)
        .post('/api/consents')
        .send({ consent_type: 'screen_recording', granted: true })
        .expect(200);
      now = 200;
      await request(app)
        .post('/api/consents')
        .send({ consent_type: 'anthropic_transmission', granted: true })
        .expect(200);

      const get = await request(app).get('/api/consents');
      expect(get.body.screen_recording.granted_at).toBe(100);
      expect(get.body.anthropic_transmission.granted_at).toBe(200);
    });

    it('revoking preserves granted_at and sets revoked_at', async () => {
      let now = 100;
      const app = buildApp(db, () => now);
      await request(app)
        .post('/api/consents')
        .send({ consent_type: 'anthropic_transmission', granted: true })
        .expect(200);
      now = 555;
      await request(app)
        .post('/api/consents')
        .send({ consent_type: 'anthropic_transmission', granted: false })
        .expect(200);

      const get = await request(app).get('/api/consents');
      expect(get.body.anthropic_transmission).toEqual({
        consent_type: 'anthropic_transmission',
        granted: false,
        granted_at: 100,
        revoked_at: 555,
      });
    });

    it('rejects unknown consent_type with 400 validation_error', async () => {
      const app = buildApp(db);
      const res = await request(app)
        .post('/api/consents')
        .send({ consent_type: 'face_recognition', granted: true });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects missing granted field with 400 validation_error', async () => {
      const app = buildApp(db);
      const res = await request(app)
        .post('/api/consents')
        .send({ consent_type: 'screen_recording' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects non-boolean granted with 400 validation_error', async () => {
      const app = buildApp(db);
      const res = await request(app)
        .post('/api/consents')
        .send({ consent_type: 'screen_recording', granted: 'yes' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('keeps a single row when same type is granted twice (PK consent_type)', async () => {
      let now = 1;
      const app = buildApp(db, () => now);
      await request(app)
        .post('/api/consents')
        .send({ consent_type: 'screen_recording', granted: true })
        .expect(200);
      now = 2;
      await request(app)
        .post('/api/consents')
        .send({ consent_type: 'screen_recording', granted: true })
        .expect(200);

      const count = db
        .prepare('SELECT COUNT(*) AS c FROM consents')
        .get() as { c: number };
      expect(count.c).toBe(1);
    });
  });
});
