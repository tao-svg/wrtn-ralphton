import {
  SystemPanelLaunchRequestSchema,
  type ChecklistFile,
} from '@onboarding/shared';
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';

import {
  InvalidPanelUrlError,
  UnsupportedPlatformError,
  launchSystemPanel,
  type SystemPanelRunner,
} from '../p5-system-panel/index.js';

export interface SystemPanelRouterDeps {
  checklist: ChecklistFile;
  runner?: SystemPanelRunner;
  platform?: NodeJS.Platform;
}

export function createSystemPanelRouter(deps: SystemPanelRouterDeps): Router {
  const router = Router();

  router.post(
    '/api/system-panel/launch',
    (req: Request, res: Response, next: NextFunction) => {
      const parsed = SystemPanelLaunchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }

      const resolved = resolveUrl(parsed.data, deps.checklist);
      if (resolved.kind === 'item_not_found') {
        res.status(404).json({ error: 'item_not_found' });
        return;
      }
      if (resolved.kind === 'step_not_found') {
        res.status(404).json({ error: 'step_not_found' });
        return;
      }
      if (resolved.kind === 'panel_url_not_defined') {
        res.status(400).json({ error: 'panel_url_not_defined' });
        return;
      }

      launchSystemPanel(resolved.url, {
        runner: deps.runner,
        platform: deps.platform,
      })
        .then(() => {
          res.status(200).json({ ok: true, url: resolved.url });
        })
        .catch((err: unknown) => {
          if (err instanceof InvalidPanelUrlError) {
            res.status(400).json({ error: 'invalid_panel_url' });
            return;
          }
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

type ResolvedUrl =
  | { kind: 'ok'; url: string }
  | { kind: 'item_not_found' }
  | { kind: 'step_not_found' }
  | { kind: 'panel_url_not_defined' };

function resolveUrl(
  body: { url?: string; item_id?: string; step_id?: string },
  checklist: ChecklistFile,
): ResolvedUrl {
  if (typeof body.url === 'string' && body.url.length > 0) {
    return { kind: 'ok', url: body.url };
  }

  // body schema guarantees item_id + step_id when url is missing.
  const itemId = body.item_id;
  const stepId = body.step_id;
  if (typeof itemId !== 'string' || typeof stepId !== 'string') {
    return { kind: 'panel_url_not_defined' };
  }

  const item = checklist.items.find((i) => i.id === itemId);
  if (!item) return { kind: 'item_not_found' };

  const step = item.ai_coaching?.steps.find((s) => s.id === stepId);
  if (!step) return { kind: 'step_not_found' };

  if (typeof step.system_panel_url !== 'string' || step.system_panel_url.length === 0) {
    return { kind: 'panel_url_not_defined' };
  }

  return { kind: 'ok', url: step.system_panel_url };
}
