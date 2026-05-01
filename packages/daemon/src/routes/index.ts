import type { ChecklistFile } from '@onboarding/shared';
import type { Application } from 'express';

import type { DatabaseInstance } from '../db/index.js';
import { createChecklistRouter } from './checklist.js';

export interface ApiRoutesDeps {
  checklist: ChecklistFile;
  db: DatabaseInstance;
  now?: () => number;
}

export function registerApiRoutes(app: Application, deps: ApiRoutesDeps): void {
  app.use(createChecklistRouter(deps));
}
