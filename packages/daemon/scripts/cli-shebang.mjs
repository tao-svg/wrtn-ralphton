import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cliFile = join(here, '..', 'dist', 'cli', 'index.js');

if (!existsSync(cliFile)) {
  console.error(`[cli-shebang] cli not found: ${cliFile}`);
  process.exit(1);
}

const SHEBANG = '#!/usr/bin/env node\n';
const contents = readFileSync(cliFile, 'utf-8');
if (!contents.startsWith('#!')) {
  writeFileSync(cliFile, SHEBANG + contents, 'utf-8');
}
chmodSync(cliFile, 0o755);
console.log(`[cli-shebang] prepared ${cliFile}`);
