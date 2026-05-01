import { homedir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { defaultDbPath } from '../src/db/index.js';

describe('defaultDbPath', () => {
  it('points at ~/.onboarding/agent.db', () => {
    expect(defaultDbPath()).toBe(join(homedir(), '.onboarding', 'agent.db'));
  });
});
