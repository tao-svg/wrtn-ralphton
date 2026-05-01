import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import pino from 'pino';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type DatabaseInstance } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import {
  ALERT_THRESHOLD,
  PAUSE_THRESHOLD,
  bucketIdForHour,
  createRateLimit,
  hourBoundaryAfter,
} from '../src/p8-vision/rate-limit.js';
import { createRateLimitRouter } from '../src/routes/rate-limit.js';
import { createServer } from '../src/server.js';

const silentLogger = pino({ level: 'silent' });

function buildApp(db: DatabaseInstance, now: () => number = Date.now) {
  return createServer({
    logger: silentLogger,
    registerRoutes: (app) => {
      app.use(createRateLimitRouter({ db, now }));
    },
  });
}

describe('p8-vision/rate-limit — bucketId / hour boundary helpers', () => {
  it('bucketIdForHour folds same-hour timestamps to the same id', () => {
    const t = 1_700_000_000_000;
    expect(bucketIdForHour(t)).toBe(bucketIdForHour(t + 60_000));
  });

  it('bucketIdForHour rolls forward when hour ticks over', () => {
    const start = 1_700_000_000_000;
    const startBucket = bucketIdForHour(start);
    const nextBucket = bucketIdForHour(start + 3_600_000);
    expect(nextBucket).not.toBe(startBucket);
  });

  it('hourBoundaryAfter is now rounded up to the next hour-of-epoch', () => {
    const t = 1_700_000_000_000;
    const next = hourBoundaryAfter(t);
    expect(next).toBeGreaterThan(t);
    expect(next % 3_600_000).toBe(0);
  });

  it('exposes thresholds 100 / 200', () => {
    expect(ALERT_THRESHOLD).toBe(100);
    expect(PAUSE_THRESHOLD).toBe(200);
  });
});

describe('p8-vision/rate-limit — checkAndIncrement state transitions', () => {
  let tmpDir: string;
  let db: DatabaseInstance;
  // 정시(00:00:00 UTC) 정확히 정렬된 임의의 시각
  const baseHour = Math.floor(1_700_000_000_000 / 3_600_000) * 3_600_000;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-rate-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('first call: state=normal, current_hour_calls=1, allowed=true', () => {
    const guard = createRateLimit({ db, now: () => baseHour });
    const result = guard.checkAndIncrement();
    expect(result).toEqual({
      allowed: true,
      state: 'normal',
      current_hour_calls: 1,
      reset_at: baseHour + 3_600_000,
    });
  });

  it('99 calls: still normal', () => {
    const guard = createRateLimit({ db, now: () => baseHour });
    let last = guard.checkAndIncrement();
    for (let i = 1; i < 99; i++) {
      last = guard.checkAndIncrement();
    }
    expect(last.state).toBe('normal');
    expect(last.current_hour_calls).toBe(99);
    expect(last.allowed).toBe(true);
  });

  it('100th call: state=alert, allowed=true, alert_sent flag=1', () => {
    const guard = createRateLimit({ db, now: () => baseHour });
    let last = guard.checkAndIncrement();
    for (let i = 1; i < 100; i++) {
      last = guard.checkAndIncrement();
    }
    expect(last.current_hour_calls).toBe(100);
    expect(last.state).toBe('alert');
    expect(last.allowed).toBe(true);

    const row = db
      .prepare(
        'SELECT alert_sent, paused FROM rate_limit_buckets WHERE bucket_id = ?',
      )
      .get(String(bucketIdForHour(baseHour))) as {
      alert_sent: number;
      paused: number;
    };
    expect(row.alert_sent).toBe(1);
    expect(row.paused).toBe(0);
  });

  it('alert_sent is idempotent (101st call does not re-trigger logic-wise)', () => {
    const guard = createRateLimit({ db, now: () => baseHour });
    for (let i = 0; i < 101; i++) {
      guard.checkAndIncrement();
    }
    const row = db
      .prepare(
        'SELECT alert_sent, call_count FROM rate_limit_buckets WHERE bucket_id = ?',
      )
      .get(String(bucketIdForHour(baseHour))) as {
      alert_sent: number;
      call_count: number;
    };
    expect(row.alert_sent).toBe(1);
    expect(row.call_count).toBe(101);
  });

  it('200th call: state=paused, allowed=true (counted), paused flag=1', () => {
    const guard = createRateLimit({ db, now: () => baseHour });
    let last = guard.checkAndIncrement();
    for (let i = 1; i < 200; i++) {
      last = guard.checkAndIncrement();
    }
    expect(last.current_hour_calls).toBe(200);
    expect(last.state).toBe('paused');
    expect(last.allowed).toBe(true);

    const row = db
      .prepare(
        'SELECT paused FROM rate_limit_buckets WHERE bucket_id = ?',
      )
      .get(String(bucketIdForHour(baseHour))) as { paused: number };
    expect(row.paused).toBe(1);
  });

  it('201st call: paused, allowed=false, count NOT incremented', () => {
    const guard = createRateLimit({ db, now: () => baseHour });
    for (let i = 0; i < 200; i++) {
      guard.checkAndIncrement();
    }
    const blocked = guard.checkAndIncrement();
    expect(blocked.allowed).toBe(false);
    expect(blocked.state).toBe('paused');
    expect(blocked.current_hour_calls).toBe(200);
    expect(blocked.reset_at).toBe(baseHour + 3_600_000);

    const row = db
      .prepare(
        'SELECT call_count FROM rate_limit_buckets WHERE bucket_id = ?',
      )
      .get(String(bucketIdForHour(baseHour))) as { call_count: number };
    expect(row.call_count).toBe(200);
  });

  it('next hour: fresh bucket, count resets to 1', () => {
    let now = baseHour;
    const guard = createRateLimit({ db, now: () => now });
    for (let i = 0; i < 50; i++) {
      guard.checkAndIncrement();
    }
    now = baseHour + 3_600_000;
    const next = guard.checkAndIncrement();
    expect(next.current_hour_calls).toBe(1);
    expect(next.state).toBe('normal');
    expect(next.allowed).toBe(true);
    expect(next.reset_at).toBe(baseHour + 2 * 3_600_000);
  });

  it('paused bucket does not bleed into the next hour', () => {
    let now = baseHour;
    const guard = createRateLimit({ db, now: () => now });
    for (let i = 0; i < 200; i++) {
      guard.checkAndIncrement();
    }
    expect(guard.checkAndIncrement().allowed).toBe(false);

    now = baseHour + 3_600_000;
    const fresh = guard.checkAndIncrement();
    expect(fresh.allowed).toBe(true);
    expect(fresh.state).toBe('normal');
    expect(fresh.current_hour_calls).toBe(1);
  });
});

describe('p8-vision/rate-limit — status() (read-only)', () => {
  let tmpDir: string;
  let db: DatabaseInstance;
  const baseHour = Math.floor(1_700_000_000_000 / 3_600_000) * 3_600_000;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-rate-status-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns zero-state defaults when no bucket exists', () => {
    const guard = createRateLimit({ db, now: () => baseHour });
    const res = guard.status();
    expect(res).toEqual({
      allowed: true,
      state: 'normal',
      current_hour_calls: 0,
      reset_at: baseHour + 3_600_000,
    });
  });

  it('does not increment when called', () => {
    const guard = createRateLimit({ db, now: () => baseHour });
    guard.checkAndIncrement();
    guard.status();
    guard.status();
    const row = db
      .prepare(
        'SELECT call_count FROM rate_limit_buckets WHERE bucket_id = ?',
      )
      .get(String(bucketIdForHour(baseHour))) as { call_count: number };
    expect(row.call_count).toBe(1);
  });
});

describe('GET /api/vision/rate-limit', () => {
  let tmpDir: string;
  let db: DatabaseInstance;
  const baseHour = Math.floor(1_700_000_000_000 / 3_600_000) * 3_600_000;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-rate-route-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns the PRD §9.1.5 shape with default zero state', async () => {
    const app = buildApp(db, () => baseHour);
    const res = await request(app).get('/api/vision/rate-limit');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      current_hour_calls: 0,
      state: 'normal',
      reset_at: baseHour + 3_600_000,
    });
  });

  it('reflects an existing bucket count and alert state', async () => {
    const guard = createRateLimit({ db, now: () => baseHour });
    for (let i = 0; i < 100; i++) guard.checkAndIncrement();

    const app = buildApp(db, () => baseHour);
    const res = await request(app).get('/api/vision/rate-limit');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      current_hour_calls: 100,
      state: 'alert',
      reset_at: baseHour + 3_600_000,
    });
  });

  it('reflects paused state once 200 calls accumulate', async () => {
    const guard = createRateLimit({ db, now: () => baseHour });
    for (let i = 0; i < 200; i++) guard.checkAndIncrement();

    const app = buildApp(db, () => baseHour);
    const res = await request(app).get('/api/vision/rate-limit');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      current_hour_calls: 200,
      state: 'paused',
      reset_at: baseHour + 3_600_000,
    });
  });
});
