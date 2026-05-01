import type { ChecklistFile } from '@onboarding/shared';
import type { Application } from 'express';
import type { Logger } from 'pino';

import type { DatabaseInstance } from '../db/index.js';
import type { ProbeRunner } from '../p1-state-probe/probes.js';
import type { ClipboardRunner } from '../p2-clipboard/index.js';
import { createChecklistRouter } from './checklist.js';
import { createClipboardRouter } from './clipboard.js';
import { createConsentsRouter } from './consents.js';
import { createStateProbeRouter } from './state-probe.js';

export interface ApiRoutesDeps {
  checklist: ChecklistFile;
  db: DatabaseInstance;
  now?: () => number;
  probeRunner?: ProbeRunner;
  clipboardRunner?: ClipboardRunner;
  clipboardPlatform?: NodeJS.Platform;
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
}
