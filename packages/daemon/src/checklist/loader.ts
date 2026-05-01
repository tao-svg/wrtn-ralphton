import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ChecklistFileSchema,
  type ChecklistFile,
} from '@onboarding/shared';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));

// loader.ts lives at packages/daemon/{src,dist}/checklist/loader.{ts,js}.
// `../../content/checklist.yaml` resolves to packages/daemon/content/checklist.yaml
// from either location.
const DEFAULT_PATH = join(HERE, '..', '..', 'content', 'checklist.yaml');

export interface LoadChecklistOptions {
  path?: string;
}

let cached: ChecklistFile | null = null;

export function loadChecklist(options: LoadChecklistOptions = {}): ChecklistFile {
  if (options.path) {
    return parse(options.path);
  }
  if (cached) return cached;
  cached = parse(DEFAULT_PATH);
  return cached;
}

export function resetChecklistCache(): void {
  cached = null;
}

function parse(path: string): ChecklistFile {
  const raw = readFileSync(path, 'utf-8');
  const data: unknown = parseYaml(raw);
  return ChecklistFileSchema.parse(data);
}
