import type { ItemState, ItemStatus } from '@onboarding/shared';

import type { DatabaseInstance } from '../db/index.js';

interface ItemStateRow {
  item_id: string;
  status: ItemStatus;
  current_step: string | null;
  started_at: number | null;
  completed_at: number | null;
  attempt_count: number;
}

export interface ChecklistRepository {
  getState(itemId: string): ItemState | null;
  startItem(itemId: string, now: number): void;
}

export function createChecklistRepository(
  db: DatabaseInstance,
): ChecklistRepository {
  const selectStmt = db.prepare(
    `SELECT item_id, status, current_step, started_at, completed_at, attempt_count
       FROM item_states
      WHERE item_id = ?`,
  );

  // INSERT new row in 'in_progress' with attempt_count=1, OR
  // bump existing row to 'in_progress', refresh started_at, attempt_count++.
  const startStmt = db.prepare(
    `INSERT INTO item_states
       (item_id, status, current_step, started_at, completed_at, attempt_count)
     VALUES (@item_id, 'in_progress', NULL, @now, NULL, 1)
     ON CONFLICT(item_id) DO UPDATE SET
       status = 'in_progress',
       started_at = @now,
       attempt_count = item_states.attempt_count + 1`,
  );

  return {
    getState(itemId) {
      const row = selectStmt.get(itemId) as ItemStateRow | undefined;
      if (!row) return null;
      return {
        item_id: row.item_id,
        status: row.status,
        current_step: row.current_step,
        started_at: row.started_at,
        completed_at: row.completed_at,
        attempt_count: row.attempt_count,
      };
    },

    startItem(itemId, now) {
      startStmt.run({ item_id: itemId, now });
    },
  };
}
