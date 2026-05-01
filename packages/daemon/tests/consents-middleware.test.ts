import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import pino from 'pino';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createConsentsRepository } from '../src/consents/repository.js';
import { requireConsent } from '../src/consents/middleware.js';
import { openDatabase, type DatabaseInstance } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { createServer } from '../src/server.js';

const silentLogger = pino({ level: 'silent' });

function buildApp(
  db: DatabaseInstance,
  required: Array<'screen_recording' | 'anthropic_transmission'>,
) {
  return createServer({
    logger: silentLogger,
    registerRoutes: (app) => {
      app.get(
        '/__test/protected',
        requireConsent(db, ...required),
        (_req, res) => {
          res.status(200).json({ ok: true });
        },
      );
    },
  });
}

describe('requireConsent middleware', () => {
  let tmpDir: string;
  let db: DatabaseInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-consents-mw-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes through when all required consents are granted', async () => {
    const repo = createConsentsRepository(db);
    repo.upsert('screen_recording', true, 1);
    repo.upsert('anthropic_transmission', true, 1);

    const app = buildApp(db, ['screen_recording', 'anthropic_transmission']);
    const res = await request(app).get('/__test/protected');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 401 screen_recording_permission_required when SR missing', async () => {
    const repo = createConsentsRepository(db);
    repo.upsert('anthropic_transmission', true, 1);

    const app = buildApp(db, ['screen_recording', 'anthropic_transmission']);
    const res = await request(app).get('/__test/protected');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'screen_recording_permission_required' });
  });

  it('returns 401 SR error when both missing (SR takes precedence)', async () => {
    const app = buildApp(db, ['screen_recording', 'anthropic_transmission']);
    const res = await request(app).get('/__test/protected');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'screen_recording_permission_required' });
  });

  it('returns 403 consent_required with missing array when only anthropic missing', async () => {
    const repo = createConsentsRepository(db);
    repo.upsert('screen_recording', true, 1);

    const app = buildApp(db, ['screen_recording', 'anthropic_transmission']);
    const res = await request(app).get('/__test/protected');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: 'consent_required',
      missing: ['anthropic_transmission'],
    });
  });

  it('returns 403 with missing array when only anthropic_transmission required and missing', async () => {
    const app = buildApp(db, ['anthropic_transmission']);
    const res = await request(app).get('/__test/protected');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: 'consent_required',
      missing: ['anthropic_transmission'],
    });
  });

  it('treats revoked consent as missing', async () => {
    const repo = createConsentsRepository(db);
    repo.upsert('anthropic_transmission', true, 1);
    repo.upsert('anthropic_transmission', false, 2);

    const app = buildApp(db, ['anthropic_transmission']);
    const res = await request(app).get('/__test/protected');
    expect(res.status).toBe(403);
    expect(res.body.missing).toEqual(['anthropic_transmission']);
  });

  it('passes through when no consents are required', async () => {
    const app = buildApp(db, []);
    const res = await request(app).get('/__test/protected');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
