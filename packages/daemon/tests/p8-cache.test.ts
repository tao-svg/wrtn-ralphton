import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  VisionGuideResult,
  VisionVerifyResult,
} from '@onboarding/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type DatabaseInstance } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import {
  CACHE_TTL_MS,
  buildCacheKey,
  createVisionCache,
} from '../src/p8-vision/cache.js';

const guideResult: VisionGuideResult = {
  type: 'guide',
  message: 'click the orange button',
  confidence: 'high',
};

const verifyResult: VisionVerifyResult = {
  type: 'verify',
  status: 'pass',
  reasoning: 'page rendered as expected',
  next_action_hint: 'continue',
};

describe('p8-vision/cache — buildCacheKey', () => {
  it('uses requestType:itemId:stepId:imageHash format', () => {
    const key = buildCacheKey({
      requestType: 'guide',
      itemId: 'item-1',
      stepId: 'step-2',
      imageHash: 'abc123',
    });
    expect(key).toBe('guide:item-1:step-2:abc123');
  });

  it('returns a different key when imageHash differs', () => {
    const a = buildCacheKey({
      requestType: 'guide',
      itemId: 'i',
      stepId: 's',
      imageHash: 'hash-a',
    });
    const b = buildCacheKey({
      requestType: 'guide',
      itemId: 'i',
      stepId: 's',
      imageHash: 'hash-b',
    });
    expect(a).not.toBe(b);
  });

  it('returns a different key when requestType differs (guide vs verify)', () => {
    const g = buildCacheKey({
      requestType: 'guide',
      itemId: 'i',
      stepId: 's',
      imageHash: 'h',
    });
    const v = buildCacheKey({
      requestType: 'verify',
      itemId: 'i',
      stepId: 's',
      imageHash: 'h',
    });
    expect(g).not.toBe(v);
  });
});

describe('p8-vision/cache — TTL constant', () => {
  it('exposes 30s TTL', () => {
    expect(CACHE_TTL_MS).toBe(30_000);
  });
});

describe('p8-vision/cache — set/get round-trip', () => {
  let tmpDir: string;
  let db: DatabaseInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-cache-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when no row exists', () => {
    const cache = createVisionCache({ db });
    expect(cache.getCached('missing-key')).toBeNull();
  });

  it('stores a guide result and returns it on a fresh get', () => {
    const fixedNow = 1_700_000_000_000;
    const cache = createVisionCache({ db, now: () => fixedNow });
    cache.setCached('k1', guideResult);
    expect(cache.getCached('k1')).toEqual(guideResult);
  });

  it('stores a verify result and returns it on a fresh get', () => {
    const fixedNow = 1_700_000_000_000;
    const cache = createVisionCache({ db, now: () => fixedNow });
    cache.setCached('k2', verifyResult);
    expect(cache.getCached('k2')).toEqual(verifyResult);
  });

  it('overwrites the existing row when set is called twice with the same key', () => {
    let now = 1_700_000_000_000;
    const cache = createVisionCache({ db, now: () => now });
    cache.setCached('k', guideResult);
    now += 1000;
    const second: VisionGuideResult = {
      type: 'guide',
      message: 'click the blue button',
      confidence: 'low',
    };
    cache.setCached('k', second);
    expect(cache.getCached('k')).toEqual(second);
  });

  it('persists ttl_at = now + 30s', () => {
    const fixedNow = 1_700_000_000_000;
    const cache = createVisionCache({ db, now: () => fixedNow });
    cache.setCached('k', guideResult);
    const row = db
      .prepare('SELECT ttl_at FROM vision_cache WHERE cache_key = ?')
      .get('k') as { ttl_at: number };
    expect(row.ttl_at).toBe(fixedNow + 30_000);
  });
});

describe('p8-vision/cache — TTL expiry / lazy cleanup', () => {
  let tmpDir: string;
  let db: DatabaseInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-cache-ttl-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null after TTL elapses', () => {
    let now = 1_700_000_000_000;
    const cache = createVisionCache({ db, now: () => now });
    cache.setCached('k', guideResult);
    now += 30_001;
    expect(cache.getCached('k')).toBeNull();
  });

  it('returns the value at exactly ttl_at-1ms', () => {
    let now = 1_700_000_000_000;
    const cache = createVisionCache({ db, now: () => now });
    cache.setCached('k', guideResult);
    now += 29_999;
    expect(cache.getCached('k')).toEqual(guideResult);
  });

  it('lazily deletes the expired row on get', () => {
    let now = 1_700_000_000_000;
    const cache = createVisionCache({ db, now: () => now });
    cache.setCached('k', guideResult);
    now += 30_001;
    cache.getCached('k');
    const row = db
      .prepare('SELECT cache_key FROM vision_cache WHERE cache_key = ?')
      .get('k');
    expect(row).toBeUndefined();
  });

  it('cleans up other expired rows opportunistically', () => {
    let now = 1_700_000_000_000;
    const cache = createVisionCache({ db, now: () => now });
    cache.setCached('expired', guideResult);
    now += 30_001;
    cache.setCached('fresh', verifyResult);
    cache.getCached('fresh');
    const expired = db
      .prepare('SELECT cache_key FROM vision_cache WHERE cache_key = ?')
      .get('expired');
    expect(expired).toBeUndefined();
  });

  it('uses idx_vision_cache_ttl for cleanup queries (sanity check that index exists)', () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all() as Array<{ name: string }>;
    expect(indexes.map((i) => i.name)).toContain('idx_vision_cache_ttl');
  });
});

describe('p8-vision/cache — different keys map to different rows', () => {
  let tmpDir: string;
  let db: DatabaseInstance;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-cache-keys-'));
    db = openDatabase(join(tmpDir, 'agent.db'));
    migrate(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('different imageHash → independent entries', () => {
    const fixedNow = 1_700_000_000_000;
    const cache = createVisionCache({ db, now: () => fixedNow });
    const k1 = buildCacheKey({
      requestType: 'guide',
      itemId: 'i',
      stepId: 's',
      imageHash: 'h1',
    });
    const k2 = buildCacheKey({
      requestType: 'guide',
      itemId: 'i',
      stepId: 's',
      imageHash: 'h2',
    });
    cache.setCached(k1, guideResult);
    expect(cache.getCached(k1)).toEqual(guideResult);
    expect(cache.getCached(k2)).toBeNull();
  });
});
