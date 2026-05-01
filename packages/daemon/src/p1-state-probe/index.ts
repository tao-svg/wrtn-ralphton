import type { ChecklistFile } from '@onboarding/shared';
import type { Logger } from 'pino';

import type { DatabaseInstance } from '../db/index.js';
import {
  defaultProbeRunner,
  runProbe,
  type ProbeRunner,
} from './probes.js';

export { defaultProbeRunner, runProbe } from './probes.js';
export type { ProbeRunner, ProbeResult } from './probes.js';

export interface RunStateProbeOptions {
  checklist: ChecklistFile;
  db: DatabaseInstance;
  runner?: ProbeRunner;
  now?: () => number;
  logger?: Logger;
}

export interface StateProbeSummary {
  itemsChecked: number;
  itemsCompleted: string[];
  itemsSkipped: string[];
}

export async function runStateProbe(
  options: RunStateProbeOptions,
): Promise<StateProbeSummary> {
  const runner = options.runner ?? defaultProbeRunner;
  const now = options.now ?? Date.now;
  const logger = options.logger;

  const completedRows = options.db
    .prepare(`SELECT item_id FROM item_states WHERE status = 'completed'`)
    .all() as Array<{ item_id: string }>;
  const alreadyCompleted = new Set(completedRows.map((r) => r.item_id));

  const markCompleted = options.db.prepare(
    `INSERT INTO item_states
       (item_id, status, current_step, started_at, completed_at, attempt_count)
     VALUES (@item_id, 'completed', NULL, NULL, @now, 1)
     ON CONFLICT(item_id) DO UPDATE SET
       status       = 'completed',
       completed_at = @now`,
  );

  const summary: StateProbeSummary = {
    itemsChecked: 0,
    itemsCompleted: [],
    itemsSkipped: [],
  };

  for (const item of options.checklist.items) {
    if (alreadyCompleted.has(item.id)) {
      summary.itemsSkipped.push(item.id);
      continue;
    }
    if (!item.verification) continue;

    summary.itemsChecked += 1;
    const result = await runProbe(item.verification, runner);
    logger?.info(
      { item_id: item.id, status: result.status },
      'state_probe_result',
    );

    if (result.status === 'PASS') {
      markCompleted.run({ item_id: item.id, now: now() });
      summary.itemsCompleted.push(item.id);
    }
  }

  logger?.info(
    {
      checked: summary.itemsChecked,
      completed: summary.itemsCompleted.length,
      skipped: summary.itemsSkipped.length,
    },
    'state_probe_complete',
  );
  return summary;
}
