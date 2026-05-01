import { homedir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BASE_URL,
  defaultDbFilePath,
  defaultPidFilePath,
  onboardingHome,
} from '../src/cli/paths.js';

describe('cli paths', () => {
  it('points DEFAULT_BASE_URL at localhost:7777 (PRD §9)', () => {
    expect(DEFAULT_BASE_URL).toBe('http://localhost:7777');
  });

  it('onboardingHome is ~/.onboarding', () => {
    expect(onboardingHome()).toBe(join(homedir(), '.onboarding'));
  });

  it('defaultPidFilePath is ~/.onboarding/daemon.pid', () => {
    expect(defaultPidFilePath()).toBe(
      join(homedir(), '.onboarding', 'daemon.pid'),
    );
  });

  it('defaultDbFilePath matches the daemon defaultDbPath layout', () => {
    expect(defaultDbFilePath()).toBe(
      join(homedir(), '.onboarding', 'agent.db'),
    );
  });
});
