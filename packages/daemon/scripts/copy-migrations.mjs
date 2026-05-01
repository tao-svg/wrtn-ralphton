import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, '..', 'src', 'db', 'migrations');
const to = join(here, '..', 'dist', 'db', 'migrations');

if (!existsSync(from)) {
  console.error(`[copy-migrations] source not found: ${from}`);
  process.exit(1);
}

cpSync(from, to, { recursive: true });
console.log(`[copy-migrations] copied ${from} -> ${to}`);
