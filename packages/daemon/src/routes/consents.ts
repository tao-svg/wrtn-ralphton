import { PostConsentRequestSchema } from '@onboarding/shared';
import { Router, type Request, type Response, type NextFunction } from 'express';

import { createConsentsRepository } from '../consents/repository.js';
import type { DatabaseInstance } from '../db/index.js';

export interface ConsentsRouterDeps {
  db: DatabaseInstance;
  now?: () => number;
}

export function createConsentsRouter(deps: ConsentsRouterDeps): Router {
  const router = Router();
  const repo = createConsentsRepository(deps.db);
  const now = deps.now ?? Date.now;

  router.get('/api/consents', (_req: Request, res: Response) => {
    res.status(200).json(repo.getAll());
  });

  router.post(
    '/api/consents',
    (req: Request, res: Response, next: NextFunction) => {
      const parsed = PostConsentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }
      repo.upsert(parsed.data.consent_type, parsed.data.granted, now());
      res.status(200).json({ ok: true });
    },
  );

  return router;
}
