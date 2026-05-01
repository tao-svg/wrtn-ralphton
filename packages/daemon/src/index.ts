import { defaultDbPath, openDatabase } from './db/index.js';
import { migrate } from './db/migrate.js';
import { logger } from './logger.js';
import { createServer } from './server.js';

const DEFAULT_PORT = 7777;

function parsePort(): number {
  const raw = process.env.PORT;
  if (!raw) return DEFAULT_PORT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PORT;
}

function bootstrap(): void {
  const dbPath = process.env.ONBOARDING_DB_PATH ?? defaultDbPath();
  const db = openDatabase(dbPath);
  const result = migrate(db);
  logger.info(
    { db: dbPath, applied: result.applied, skipped: result.skipped },
    'migrations_complete',
  );

  const port = parsePort();
  const app = createServer({ logger });
  const server = app.listen(port, () => {
    logger.info({ port }, 'daemon_listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown_started');
    server.close((err) => {
      if (err) logger.error({ err }, 'server_close_error');
      try {
        db.close();
      } catch (closeErr) {
        logger.error({ err: closeErr }, 'db_close_error');
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();
