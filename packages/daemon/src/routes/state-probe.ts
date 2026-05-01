import type { ChecklistFile } from '@onboarding/shared';
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Logger } from 'pino';

import type { DatabaseInstance } from '../db/index.js';
import { runStateProbe } from '../p1-state-probe/index.js';
import type { ProbeRunner } from '../p1-state-probe/probes.js';

export interface StateProbeRouterDeps {
  checklist: ChecklistFile;
  db: DatabaseInstance;
  runner?: ProbeRunner;
  now?: () => number;
  logger?: Logger;
}

export function createStateProbeRouter(deps: StateProbeRouterDeps): Router {
  const router = Router();

  router.post(
    '/api/state-probe/run',
    (_req: Request, res: Response, next: NextFunction) => {
      runStateProbe({
        checklist: deps.checklist,
        db: deps.db,
        runner: deps.runner,
        now: deps.now,
        logger: deps.logger,
      })
        .then((summary) => {
          res.status(200).json(summary);
        })
        .catch(next);
    },
  );

  return router;
}
