import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import pc from 'picocolors';

import {
  DEFAULT_BASE_URL,
  defaultDbFilePath,
  defaultPidFilePath,
} from './paths.js';
import type { WizardResult } from './wizard.js';

export interface SpawnedProcess {
  pid?: number;
  unref(): void;
}

export type SpawnFn = (
  command: string,
  args: string[],
  options: { detached: boolean; stdio: 'ignore'; env: NodeJS.ProcessEnv },
) => SpawnedProcess;

export interface StartDeps {
  pidFilePath?: string;
  dbFilePath?: string;
  daemonEntry?: string;
  baseUrl?: string;
  spawn: SpawnFn;
  runWizard: (deps: { dbFilePath: string }) => Promise<WizardResult>;
  isProcessAlive: (pid: number) => boolean;
  waitForReady: (baseUrl: string) => Promise<boolean>;
  log?: (line: string) => void;
  env?: NodeJS.ProcessEnv;
  now: () => number;
}

function readExistingPid(pidFilePath: string): number | null {
  try {
    if (!existsSync(pidFilePath)) return null;
    const raw = readFileSync(pidFilePath, 'utf-8').trim();
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function runStart(deps: StartDeps): Promise<void> {
  const log = deps.log ?? ((l: string) => console.log(l));
  const pidFilePath = deps.pidFilePath ?? defaultPidFilePath();
  const dbFilePath = deps.dbFilePath ?? defaultDbFilePath();
  const baseUrl = deps.baseUrl ?? DEFAULT_BASE_URL;
  const env = deps.env ?? process.env;

  const existingPid = readExistingPid(pidFilePath);
  if (existingPid && deps.isProcessAlive(existingPid)) {
    log(
      pc.yellow(
        `데몬이 이미 실행 중입니다 (PID ${existingPid}). 'onboarding status'로 상태를 확인하세요.`,
      ),
    );
    return;
  }

  const daemonEntry = deps.daemonEntry ?? resolveDaemonEntry();
  log(pc.bold('데몬을 기동합니다...'));

  const child = deps.spawn('node', [daemonEntry], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...env,
      ONBOARDING_DB_PATH: dbFilePath,
    },
  });
  child.unref();

  if (typeof child.pid === 'number') {
    mkdirSync(dirname(pidFilePath), { recursive: true });
    writeFileSync(pidFilePath, String(child.pid), 'utf-8');
  }

  const ready = await deps.waitForReady(baseUrl);
  if (!ready) {
    log(
      pc.red(
        `데몬 기동을 확인하지 못했습니다. 'onboarding status'로 다시 확인해주세요.`,
      ),
    );
    return;
  }
  log(pc.green(`✓ 데몬이 ${baseUrl}에서 응답합니다.`));

  const wizardResult = await deps.runWizard({ dbFilePath });
  if (wizardResult.skipped) {
    log(pc.dim('첫 실행 위저드는 이미 완료되어 있습니다.'));
  }

  log('');
  log('Floating Hint Window는 SPEC-014/015 머지 후 자동 기동됩니다.');
  log(`상태 확인: ${pc.cyan('onboarding status')}`);
  log(`종료: ${pc.cyan('onboarding stop')}`);
}

function resolveDaemonEntry(): string {
  // The CLI is installed alongside the daemon entry as a sibling under dist/.
  // src/cli/start.ts → dist/cli/start.js → dist/index.js
  return new URL('../index.js', import.meta.url).pathname;
}
