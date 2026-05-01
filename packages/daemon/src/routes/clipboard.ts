import { ClipboardRequestSchema } from '@onboarding/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';

import {
  copyToClipboard,
  UnsupportedPlatformError,
  type ClipboardRunner,
} from '../p2-clipboard/index.js';

export const CLIPBOARD_MAX_BYTES = 32 * 1024;

export interface ClipboardRouterDeps {
  runner?: ClipboardRunner;
  platform?: NodeJS.Platform;
}

export function createClipboardRouter(deps: ClipboardRouterDeps = {}): Router {
  const router = Router();

  router.post(
    '/api/clipboard',
    (req: Request, res: Response, next: NextFunction) => {
      const rawCommand = (req.body as { command?: unknown } | undefined)?.command;
      if (
        typeof rawCommand === 'string' &&
        Buffer.byteLength(rawCommand, 'utf8') > CLIPBOARD_MAX_BYTES
      ) {
        res.status(413).json({ error: 'payload_too_large' });
        return;
      }

      const parsed = ClipboardRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }

      copyToClipboard(parsed.data.command, {
        runner: deps.runner,
        platform: deps.platform,
      })
        .then(() => {
          res.status(200).json({ ok: true });
        })
        .catch((err: unknown) => {
          if (err instanceof UnsupportedPlatformError) {
            res.status(500).json({ error: 'unsupported_platform' });
            return;
          }
          next(err);
        });
    },
  );

  return router;
}
