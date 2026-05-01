import express, {
  type Application,
  type ErrorRequestHandler,
  type Request,
  type Response,
} from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';

import { createHealthRouter } from './routes/health.js';

export interface ServerDeps {
  logger: Logger;
  registerRoutes?: (app: Application) => void;
}

export function createServer(deps: ServerDeps): Application {
  const app = express();
  app.locals.logger = deps.logger;
  app.use(express.json());

  app.use(createHealthRouter());

  if (deps.registerRoutes) {
    deps.registerRoutes(app);
  }

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'validation_error',
        details: err.issues,
      });
      return;
    }
    deps.logger.error({ err }, 'unhandled_error');
    res.status(500).json({ error: 'internal_server_error' });
  };
  app.use(errorHandler);

  return app;
}
