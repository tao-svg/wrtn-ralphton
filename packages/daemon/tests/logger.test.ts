import { afterEach, describe, expect, it } from 'vitest';

import { logger, resolveLogLevel } from '../src/logger.js';

const ORIGINAL = process.env.LOG_LEVEL;

function restore(): void {
  if (ORIGINAL === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = ORIGINAL;
  }
}

describe('resolveLogLevel', () => {
  afterEach(restore);

  it("falls back to 'info' when LOG_LEVEL is not set", () => {
    delete process.env.LOG_LEVEL;
    expect(resolveLogLevel()).toBe('info');
  });

  it('returns LOG_LEVEL when set', () => {
    process.env.LOG_LEVEL = 'debug';
    expect(resolveLogLevel()).toBe('debug');
  });
});

describe('logger', () => {
  it('exposes a string level', () => {
    expect(typeof logger.level).toBe('string');
    expect(logger.level.length).toBeGreaterThan(0);
  });
});
