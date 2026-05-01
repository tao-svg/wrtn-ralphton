import { existsSync, readFileSync, rmSync } from 'node:fs';

import pc from 'picocolors';

import { defaultPidFilePath } from './paths.js';

export type KillFn = (pid: number, signal: NodeJS.Signals) => void;

export interface StopDeps {
  pidFilePath?: string;
  kill: KillFn;
  isProcessAlive: (pid: number) => boolean;
  log?: (line: string) => void;
}

export interface StopResult {
  stopped: boolean;
}

const NOT_RUNNING_MESSAGE = '데몬이 실행 중이지 않습니다.';

export async function runStop(deps: StopDeps): Promise<StopResult> {
  const log = deps.log ?? ((l: string) => console.log(l));
  const pidFilePath = deps.pidFilePath ?? defaultPidFilePath();

  if (!existsSync(pidFilePath)) {
    log(pc.yellow(NOT_RUNNING_MESSAGE));
    return { stopped: false };
  }

  const raw = readFileSync(pidFilePath, 'utf-8').trim();
  const pid = Number.parseInt(raw, 10);
  if (!Number.isFinite(pid) || pid <= 0) {
    rmSync(pidFilePath, { force: true });
    log(pc.yellow(NOT_RUNNING_MESSAGE));
    return { stopped: false };
  }

  if (!deps.isProcessAlive(pid)) {
    rmSync(pidFilePath, { force: true });
    log(pc.yellow(NOT_RUNNING_MESSAGE));
    return { stopped: false };
  }

  deps.kill(pid, 'SIGTERM');
  rmSync(pidFilePath, { force: true });
  log(pc.green(`✓ 데몬을 정지했습니다 (PID ${pid}).`));
  return { stopped: true };
}
