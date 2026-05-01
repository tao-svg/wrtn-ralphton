import type { DatabaseInstance } from '../db/index.js';

// PRD §7.7 F-P8-06 / §10 AC-VIS-05 — 100/시간 알림, 200/시간 일시 정지.
export const ALERT_THRESHOLD = 100;
export const PAUSE_THRESHOLD = 200;
export const HOUR_MS = 3_600_000;

export type RateLimitState = 'normal' | 'alert' | 'paused';

export interface RateLimitResult {
  allowed: boolean;
  state: RateLimitState;
  current_hour_calls: number;
  reset_at: number;
}

export function bucketIdForHour(timestamp: number): number {
  return Math.floor(timestamp / HOUR_MS);
}

export function hourBoundaryAfter(timestamp: number): number {
  return (bucketIdForHour(timestamp) + 1) * HOUR_MS;
}

interface BucketRow {
  call_count: number;
  alert_sent: number;
  paused: number;
  reset_at: number;
}

export interface RateLimitDeps {
  db: DatabaseInstance;
  now?: () => number;
  alertThreshold?: number;
  pauseThreshold?: number;
}

export interface RateLimit {
  checkAndIncrement(): RateLimitResult;
  status(): RateLimitResult;
}

function deriveState(
  callCount: number,
  paused: number,
  alertThreshold: number,
): RateLimitState {
  if (paused === 1) return 'paused';
  if (callCount >= alertThreshold) return 'alert';
  return 'normal';
}

export function createRateLimit(deps: RateLimitDeps): RateLimit {
  const now = deps.now ?? Date.now;
  const alertThreshold = deps.alertThreshold ?? ALERT_THRESHOLD;
  const pauseThreshold = deps.pauseThreshold ?? PAUSE_THRESHOLD;
  const { db } = deps;

  const selectStmt = db.prepare<[string], BucketRow>(
    `SELECT call_count, alert_sent, paused, reset_at
     FROM rate_limit_buckets
     WHERE bucket_id = ?`,
  );
  const insertStmt = db.prepare<[string, number]>(
    `INSERT INTO rate_limit_buckets (bucket_id, call_count, alert_sent, paused, reset_at)
     VALUES (?, 0, 0, 0, ?)`,
  );
  const updateStmt = db.prepare<[number, number, number, string]>(
    `UPDATE rate_limit_buckets
     SET call_count = ?, alert_sent = ?, paused = ?
     WHERE bucket_id = ?`,
  );

  function readOrCreate(t: number): {
    bucketId: string;
    row: BucketRow;
    resetAt: number;
  } {
    const bucketId = String(bucketIdForHour(t));
    const resetAt = hourBoundaryAfter(t);
    let row = selectStmt.get(bucketId);
    if (!row) {
      insertStmt.run(bucketId, resetAt);
      row = {
        call_count: 0,
        alert_sent: 0,
        paused: 0,
        reset_at: resetAt,
      };
    }
    return { bucketId, row, resetAt };
  }

  return {
    checkAndIncrement(): RateLimitResult {
      const t = now();
      const { bucketId, row, resetAt } = readOrCreate(t);

      if (row.paused === 1) {
        return {
          allowed: false,
          state: 'paused',
          current_hour_calls: row.call_count,
          reset_at: resetAt,
        };
      }

      const nextCount = row.call_count + 1;
      const nextAlert = nextCount >= alertThreshold ? 1 : row.alert_sent;
      const nextPaused = nextCount >= pauseThreshold ? 1 : row.paused;
      updateStmt.run(nextCount, nextAlert, nextPaused, bucketId);

      return {
        allowed: true,
        state: deriveState(nextCount, nextPaused, alertThreshold),
        current_hour_calls: nextCount,
        reset_at: resetAt,
      };
    },
    status(): RateLimitResult {
      const t = now();
      const bucketId = String(bucketIdForHour(t));
      const resetAt = hourBoundaryAfter(t);
      const row = selectStmt.get(bucketId);
      if (!row) {
        return {
          allowed: true,
          state: 'normal',
          current_hour_calls: 0,
          reset_at: resetAt,
        };
      }
      return {
        allowed: row.paused === 0,
        state: deriveState(row.call_count, row.paused, alertThreshold),
        current_hour_calls: row.call_count,
        reset_at: resetAt,
      };
    },
  };
}
