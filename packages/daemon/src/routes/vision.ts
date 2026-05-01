import {
  VisionGuideRequestSchema,
  VisionVerifyRequestSchema,
} from '@onboarding/shared';
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { Logger } from 'pino';

import { requireConsent } from '../consents/middleware.js';
import type { DatabaseInstance } from '../db/index.js';
import {
  AnthropicAuthError,
  AnthropicServerError,
  AnthropicTimeoutError,
  VisionResponseFormatError,
} from '../p8-vision/anthropic-client.js';
import { ScreenRecordingDeniedError } from '../p8-vision/capture.js';
import { DebounceError } from '../p8-vision/debounce.js';
import {
  RateLimitPausedError,
  VisionItemNotFoundError,
  VisionStepNotFoundError,
  type VisionOrchestrator,
} from '../p8-vision/orchestrator.js';

// PRD §9.1.3 / §9.1.4 — both endpoints share consent and error mapping.
export interface VisionRouterDeps {
  db: DatabaseInstance;
  orchestrator: VisionOrchestrator;
  logger?: Logger;
}

export function createVisionRouter(deps: VisionRouterDeps): Router {
  const router = Router();
  const consents = requireConsent(
    deps.db,
    'screen_recording',
    'anthropic_transmission',
  );

  router.post(
    '/api/vision/guide',
    consents,
    (req: Request, res: Response, next: NextFunction) => {
      const parsed = VisionGuideRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }
      deps.orchestrator
        .runGuide({
          itemId: parsed.data.item_id,
          stepId: parsed.data.step_id,
        })
        .then((result) => {
          res.status(200).json(result);
        })
        .catch((err: unknown) => handleVisionError(err, res, next));
    },
  );

  router.post(
    '/api/vision/verify',
    consents,
    (req: Request, res: Response, next: NextFunction) => {
      const parsed = VisionVerifyRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }
      deps.orchestrator
        .runVerify({
          itemId: parsed.data.item_id,
          stepId: parsed.data.step_id,
        })
        .then((result) => {
          res.status(200).json(result);
        })
        .catch((err: unknown) => handleVisionError(err, res, next));
    },
  );

  return router;
}

function handleVisionError(
  err: unknown,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof VisionItemNotFoundError) {
    res.status(404).json({ error: 'item_not_found' });
    return;
  }
  if (err instanceof VisionStepNotFoundError) {
    res.status(404).json({ error: 'step_not_found' });
    return;
  }
  if (err instanceof ScreenRecordingDeniedError) {
    // OS-level preflight (granted=false) — same shape as the consent middleware
    // so the client treats both the same.
    res.status(401).json({ error: 'screen_recording_permission_required' });
    return;
  }
  if (err instanceof DebounceError) {
    // 1s debounce per (request_type, item, step). spec-012 §출력.
    res.status(429).json({ error: 'rate_limit_exceeded', state: 'throttled' });
    return;
  }
  if (err instanceof RateLimitPausedError) {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      state: 'paused',
      reset_at: err.resetAt,
    });
    return;
  }
  if (err instanceof AnthropicTimeoutError) {
    res.status(503).json({ error: 'vision_api_timeout' });
    return;
  }
  if (err instanceof AnthropicServerError || err instanceof AnthropicAuthError) {
    res.status(503).json({ error: 'vision_api_error' });
    return;
  }
  if (err instanceof VisionResponseFormatError) {
    res.status(503).json({ error: 'vision_response_invalid' });
    return;
  }
  next(err);
}
