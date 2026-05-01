import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import {
  loadChecklist,
  resetChecklistCache,
} from '../src/checklist/loader.js';

const EXPECTED_ITEM_IDS = [
  'install-homebrew',
  'configure-git',
  'install-security-agent',
  'setup-vpn',
  'setup-gmail-signature',
] as const;

describe('loadChecklist (bundled content/checklist.yaml)', () => {
  beforeEach(() => {
    resetChecklistCache();
  });

  it('parses the bundled yaml and exposes 5 PRD §11 items in order', () => {
    const checklist = loadChecklist();
    expect(checklist.version).toBe(2);
    expect(checklist.schema).toBe('ai-coaching');
    expect(checklist.items.map((i) => i.id)).toEqual([...EXPECTED_ITEM_IDS]);
  });

  it('caches the result across subsequent calls (same reference)', () => {
    const a = loadChecklist();
    const b = loadChecklist();
    expect(b).toBe(a);
  });
});

describe('loadChecklist with custom path', () => {
  let tmpDir: string;

  beforeEach(() => {
    resetChecklistCache();
    tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-checklist-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    resetChecklistCache();
  });

  it('parses a minimal valid yaml and returns ChecklistFile', () => {
    const path = join(tmpDir, 'good.yaml');
    writeFileSync(
      path,
      [
        'version: 2',
        'schema: ai-coaching',
        'items:',
        '  - id: hello',
        '    title: Hello',
        '    estimated_minutes: 1',
        '',
      ].join('\n'),
      'utf-8',
    );
    const checklist = loadChecklist({ path });
    expect(checklist.items).toHaveLength(1);
    expect(checklist.items[0]?.id).toBe('hello');
  });

  it('throws ZodError when required fields are missing', () => {
    const path = join(tmpDir, 'missing-title.yaml');
    writeFileSync(
      path,
      [
        'version: 2',
        'schema: ai-coaching',
        'items:',
        '  - id: hello',
        '    estimated_minutes: 1',
        '',
      ].join('\n'),
      'utf-8',
    );
    expect(() => loadChecklist({ path })).toThrow(ZodError);
  });

  it('throws ZodError when items is empty', () => {
    const path = join(tmpDir, 'empty-items.yaml');
    writeFileSync(
      path,
      ['version: 2', 'schema: ai-coaching', 'items: []', ''].join('\n'),
      'utf-8',
    );
    expect(() => loadChecklist({ path })).toThrow(ZodError);
  });

  it('throws ZodError when version is not a positive integer', () => {
    const path = join(tmpDir, 'bad-version.yaml');
    writeFileSync(
      path,
      [
        'version: 0',
        'schema: ai-coaching',
        'items:',
        '  - id: hello',
        '    title: Hello',
        '    estimated_minutes: 1',
        '',
      ].join('\n'),
      'utf-8',
    );
    expect(() => loadChecklist({ path })).toThrow(ZodError);
  });

  it('throws when the file is not yaml at all', () => {
    const path = join(tmpDir, 'not-yaml.yaml');
    writeFileSync(path, 'this is just a plain string', 'utf-8');
    expect(() => loadChecklist({ path })).toThrow();
  });

  it('does not cache when called with a custom path', () => {
    const goodPath = join(tmpDir, 'a.yaml');
    writeFileSync(
      goodPath,
      [
        'version: 2',
        'schema: ai-coaching',
        'items:',
        '  - id: a',
        '    title: A',
        '    estimated_minutes: 1',
        '',
      ].join('\n'),
      'utf-8',
    );
    const a = loadChecklist({ path: goodPath });
    const b = loadChecklist({ path: goodPath });
    expect(b).not.toBe(a);
  });
});
