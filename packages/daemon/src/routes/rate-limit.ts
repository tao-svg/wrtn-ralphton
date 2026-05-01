import { Router, type Request, type Response } from 'express';

import type { DatabaseInstance } from '../db/index.js';
import { createRateLimit } from '../p8-vision/rate-limit.js';

export interface RateLimitRouterDeps {
  db: DatabaseInstance;
  now?: () => number;
}

export function createRateLimitRouter(deps: RateLimitRouterDeps): Router {
  const router = Router();
  const guard = createRateLimit({ db: deps.db, now: deps.now });

  // PRD §9.1.5 — read-only status endpoint.
  router.get('/api/vision/rate-limit', (_req: Request, res: Response) => {
    const result = guard.status();
    res.status(200).json({
      current_hour_calls: result.current_hour_calls,
      state: result.state,
      reset_at: result.reset_at,
    });
  });

  return router;
}
