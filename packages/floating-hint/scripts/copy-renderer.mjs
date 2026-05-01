#!/usr/bin/env node
// Copies static renderer assets (index.html) into dist/ so that
// dist/renderer/index.html sits next to the compiled dist/renderer/index.js.
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const assets = [['src/renderer/index.html', 'dist/renderer/index.html']];

for (const [from, to] of assets) {
  const src = resolve(pkgRoot, from);
  const dst = resolve(pkgRoot, to);
  await mkdir(dirname(dst), { recursive: true });
  await copyFile(src, dst);
  console.log(`copied ${from} -> ${to}`);
}
