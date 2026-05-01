import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_BASE_URL = 'http://localhost:7777';

export function onboardingHome(): string {
  return join(homedir(), '.onboarding');
}

export function defaultPidFilePath(): string {
  return join(onboardingHome(), 'daemon.pid');
}

export function defaultDbFilePath(): string {
  return join(onboardingHome(), 'agent.db');
}
