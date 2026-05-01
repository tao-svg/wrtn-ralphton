import type { ChecklistFile, ChecklistItem, ItemState } from '@onboarding/shared';
import { Router, type Request, type Response } from 'express';

import {
  createChecklistRepository,
  type ChecklistRepository,
} from '../checklist/repository.js';
import type { DatabaseInstance } from '../db/index.js';

export interface ChecklistRouterDeps {
  checklist: ChecklistFile;
  db: DatabaseInstance;
  now?: () => number;
}

interface ChecklistResponseItem extends ItemState {
  title: string;
}

export function createChecklistRouter(deps: ChecklistRouterDeps): Router {
  const router = Router();
  const repo = createChecklistRepository(deps.db);
  const now = deps.now ?? Date.now;
  const itemsById = new Map<string, ChecklistItem>(
    deps.checklist.items.map((item) => [item.id, item]),
  );

  router.get('/api/checklist', (_req: Request, res: Response) => {
    const items: ChecklistResponseItem[] = deps.checklist.items.map((item) =>
      buildResponseItem(item, repo),
    );
    res.status(200).json({ items });
  });

  router.post(
    '/api/items/:itemId/start',
    (req: Request, res: Response) => {
      const itemId = req.params.itemId;
      if (!itemId || !itemsById.has(itemId)) {
        res.status(404).json({ error: 'item_not_found' });
        return;
      }
      repo.startItem(itemId, now());
      res.status(200).json({ ok: true });
    },
  );

  return router;
}

function buildResponseItem(
  item: ChecklistItem,
  repo: ChecklistRepository,
): ChecklistResponseItem {
  const state = repo.getState(item.id);
  if (state) {
    return { ...state, title: item.title };
  }
  return {
    item_id: item.id,
    title: item.title,
    status: 'pending',
    current_step: null,
    started_at: null,
    completed_at: null,
    attempt_count: 0,
  };
}
