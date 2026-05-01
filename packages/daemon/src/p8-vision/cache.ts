import type {
  VisionGuideResult,
  VisionVerifyResult,
} from '@onboarding/shared';

import type { DatabaseInstance } from '../db/index.js';

// PRD §7.7 F-P8-06 / AC-VIS-04 — 30s response cache.
export const CACHE_TTL_MS = 30_000;

export type VisionResult = VisionGuideResult | VisionVerifyResult;

export type VisionRequestType = 'guide' | 'verify';

export interface CacheKeyParts {
  requestType: VisionRequestType;
  itemId: string;
  stepId: string;
  imageHash: string;
}

export function buildCacheKey(parts: CacheKeyParts): string {
  return `${parts.requestType}:${parts.itemId}:${parts.stepId}:${parts.imageHash}`;
}

export interface VisionCacheDeps {
  db: DatabaseInstance;
  now?: () => number;
  ttlMs?: number;
}

export interface VisionCache {
  getCached(key: string): VisionResult | null;
  setCached(key: string, result: VisionResult): void;
}

export function createVisionCache(deps: VisionCacheDeps): VisionCache {
  const now = deps.now ?? Date.now;
  const ttlMs = deps.ttlMs ?? CACHE_TTL_MS;
  const { db } = deps;

  const selectStmt = db.prepare<[string, number], { response_json: string }>(
    'SELECT response_json FROM vision_cache WHERE cache_key = ? AND ttl_at > ?',
  );
  const insertStmt = db.prepare<[string, string, number]>(
    `INSERT INTO vision_cache (cache_key, response_json, ttl_at)
     VALUES (?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       response_json = excluded.response_json,
       ttl_at        = excluded.ttl_at`,
  );
  const purgeStmt = db.prepare<[number]>(
    'DELETE FROM vision_cache WHERE ttl_at <= ?',
  );

  return {
    getCached(key: string): VisionResult | null {
      const t = now();
      // Lazy cleanup: every read sweeps expired rows. The idx_vision_cache_ttl
      // index keeps this O(log n) over expired entries — see PRD §8.1.
      purgeStmt.run(t);
      const row = selectStmt.get(key, t);
      if (!row) return null;
      return JSON.parse(row.response_json) as VisionResult;
    },
    setCached(key: string, result: VisionResult): void {
      const t = now();
      insertStmt.run(key, JSON.stringify(result), t + ttlMs);
    },
  };
}
