import type { ChecklistFile } from '@onboarding/shared';
import type { Application } from 'express';
import type { Logger } from 'pino';

import type { DatabaseInstance } from '../db/index.js';
import type { ProbeRunner } from '../p1-state-probe/probes.js';
import type { ClipboardRunner } from '../p2-clipboard/index.js';
import type { VerifyRunner } from '../p4-verify/index.js';
import type { SystemPanelRunner } from '../p5-system-panel/index.js';
import type { AnthropicClientOptions } from '../p8-vision/anthropic-client.js';
import { createVisionCache } from '../p8-vision/cache.js';
import { createVisionDebounce } from '../p8-vision/debounce.js';
import {
  createVisionOrchestrator,
  type CaptureFn,
  type GuideClientFn,
  type VerifyClientFn,
  type VisionOrchestrator,
} from '../p8-vision/orchestrator.js';
import { createRateLimit } from '../p8-vision/rate-limit.js';
import { createChecklistRouter } from './checklist.js';
import { createClipboardRouter } from './clipboard.js';
import { createConsentsRouter } from './consents.js';
import { createRateLimitRouter } from './rate-limit.js';
import { createStateProbeRouter } from './state-probe.js';
import { createSystemPanelRouter } from './system-panel.js';
import { createVerifyRouter } from './verify.js';
import { createVisionRouter } from './vision.js';

export interface ApiRoutesDeps {
  checklist: ChecklistFile;
  db: DatabaseInstance;
  now?: () => number;
  probeRunner?: ProbeRunner;
  clipboardRunner?: ClipboardRunner;
  clipboardPlatform?: NodeJS.Platform;
  verifyRunner?: VerifyRunner;
  systemPanelRunner?: SystemPanelRunner;
  systemPanelPlatform?: NodeJS.Platform;
  visionOrchestrator?: VisionOrchestrator;
  visionCapture?: CaptureFn;
  visionGuideClient?: GuideClientFn;
  visionVerifyClient?: VerifyClientFn;
  visionAnthropicOptions?: AnthropicClientOptions;
  logger?: Logger;
}

export function registerApiRoutes(app: Application, deps: ApiRoutesDeps): void {
  app.use(createChecklistRouter(deps));
  app.use(createConsentsRouter({ db: deps.db, now: deps.now }));
  app.use(
    createStateProbeRouter({
      checklist: deps.checklist,
      db: deps.db,
      runner: deps.probeRunner,
      now: deps.now,
      logger: deps.logger,
    }),
  );
  app.use(
    createClipboardRouter({
      runner: deps.clipboardRunner,
      platform: deps.clipboardPlatform,
    }),
  );
  app.use(
    createVerifyRouter({
      checklist: deps.checklist,
      db: deps.db,
      runner: deps.verifyRunner,
      now: deps.now,
      logger: deps.logger,
    }),
  );
  app.use(
    createSystemPanelRouter({
      checklist: deps.checklist,
      runner: deps.systemPanelRunner,
      platform: deps.systemPanelPlatform,
    }),
  );
  app.use(createRateLimitRouter({ db: deps.db, now: deps.now }));

  const orchestrator =
    deps.visionOrchestrator ??
    createVisionOrchestrator({
      checklist: deps.checklist,
      db: deps.db,
      cache: createVisionCache({ db: deps.db, now: deps.now }),
      rateLimit: createRateLimit({ db: deps.db, now: deps.now }),
      debounce: createVisionDebounce({ now: deps.now }),
      capture: deps.visionCapture,
      guideClient: deps.visionGuideClient,
      verifyClient: deps.visionVerifyClient,
      anthropicOptions: deps.visionAnthropicOptions,
      now: deps.now,
      logger: deps.logger,
    });
  app.use(
    createVisionRouter({
      db: deps.db,
      orchestrator,
      logger: deps.logger,
    }),
  );
}
