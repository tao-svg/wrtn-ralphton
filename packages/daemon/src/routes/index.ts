import type { ChecklistFile } from '@onboarding/shared';
import type { Application } from 'express';

import type { DatabaseInstance } from '../db/index.js';
import { createChecklistRouter } from './checklist.js';
import { createConsentsRouter } from './consents.js';

export interface ApiRoutesDeps {
  checklist: ChecklistFile;
  db: DatabaseInstance;
  now?: () => number;
}

export function registerApiRoutes(app: Application, deps: ApiRoutesDeps): void {
  app.use(createChecklistRouter(deps));
  app.use(createConsentsRouter({ db: deps.db, now: deps.now }));
}
