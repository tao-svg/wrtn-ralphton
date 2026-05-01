import {
  ItemIdSchema,
  VerificationSchema,
  type ChecklistFile,
} from '@onboarding/shared';
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';

import type { DatabaseInstance } from '../db/index.js';
import {
  ItemNotFoundError,
  VerificationMissingError,
  runVerify,
  type VerifyRunner,
} from '../p4-verify/index.js';

// Local schema: verification is optional in the body — when omitted we fall
// back to the yaml's verification block (spec-007 §출력).
const VerifyRunBodySchema = z
  .object({
    item_id: ItemIdSchema,
    verification: VerificationSchema.optional(),
  })
  .strict();

export interface VerifyRouterDeps {
  checklist: ChecklistFile;
  db: DatabaseInstance;
  runner?: VerifyRunner;
  now?: () => number;
  logger?: Logger;
}

export function createVerifyRouter(deps: VerifyRouterDeps): Router {
  const router = Router();

  router.post(
    '/api/verify/run',
    (req: Request, res: Response, next: NextFunction) => {
      const parsed = VerifyRunBodySchema.safeParse(req.body);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }

      runVerify(parsed.data.item_id, {
        checklist: deps.checklist,
        db: deps.db,
        verification: parsed.data.verification,
        runner: deps.runner,
        now: deps.now,
        logger: deps.logger,
      })
        .then((result) => {
          res.status(200).json(result);
        })
        .catch((err: unknown) => {
          if (err instanceof ItemNotFoundError) {
            res.status(404).json({ error: 'item_not_found' });
            return;
          }
          if (err instanceof VerificationMissingError) {
            res.status(400).json({ error: 'verification_missing' });
            return;
          }
          next(err);
        });
    },
  );

  return router;
}
