import { loadChecklist } from './checklist/loader.js';
import { defaultDbPath, openDatabase } from './db/index.js';
import { migrate } from './db/migrate.js';
import { logger } from './logger.js';
import { runStateProbe } from './p1-state-probe/index.js';
import { registerApiRoutes } from './routes/index.js';
import { createServer } from './server.js';

const DEFAULT_PORT = 7777;

function parsePort(): number {
  const raw = process.env.PORT;
  if (!raw) return DEFAULT_PORT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PORT;
}

async function bootstrap(): Promise<void> {
  const dbPath = process.env.ONBOARDING_DB_PATH ?? defaultDbPath();
  const db = openDatabase(dbPath);
  const result = migrate(db);
  logger.info(
    { db: dbPath, applied: result.applied, skipped: result.skipped },
    'migrations_complete',
  );

  // Loading the bundled checklist must happen before the server starts.
  // An invalid yaml throws (zod) and aborts boot — see spec-003 AC.
  const checklist = loadChecklist();
  logger.info(
    { items: checklist.items.length, version: checklist.version },
    'checklist_loaded',
  );

  // Probe machine state once on boot so already-installed items auto-complete
  // before we start serving (spec-005, PRD §7.2 F-P1-01).
  await runStateProbe({ checklist, db, logger });

  const port = parsePort();
  const app = createServer({
    logger,
    registerRoutes: (a) => registerApiRoutes(a, { checklist, db, logger }),
  });
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

bootstrap().catch((err) => {
  logger.error({ err }, 'bootstrap_failed');
  process.exit(1);
});
