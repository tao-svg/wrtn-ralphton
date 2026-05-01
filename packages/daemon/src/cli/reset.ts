import { existsSync, rmSync } from 'node:fs';

import pc from 'picocolors';

import { defaultDbFilePath } from './paths.js';

export type ResetConfirmFn = (q: { message: string }) => Promise<boolean>;

export interface ResetDeps {
  dbFilePath?: string;
  yes: boolean;
  promptConfirm: ResetConfirmFn;
  log?: (line: string) => void;
}

export interface ResetResult {
  deleted: boolean;
}

export async function runReset(deps: ResetDeps): Promise<ResetResult> {
  const log = deps.log ?? ((l: string) => console.log(l));
  const dbFilePath = deps.dbFilePath ?? defaultDbFilePath();

  if (!existsSync(dbFilePath)) {
    log(pc.yellow('이미 초기화된 상태입니다 (SQLite 파일 없음).'));
    return { deleted: false };
  }

  if (!deps.yes) {
    const confirmed = await deps.promptConfirm({
      message:
        '진행 상황과 동의 기록이 모두 삭제됩니다. 정말 초기화하시겠습니까?',
    });
    if (!confirmed) {
      log(pc.dim('취소되었습니다.'));
      return { deleted: false };
    }
  }

  rmSync(dbFilePath, { force: true });
  // SQLite WAL/SHM siblings produced by `journal_mode = WAL`.
  rmSync(`${dbFilePath}-wal`, { force: true });
  rmSync(`${dbFilePath}-shm`, { force: true });

  log(pc.green('✓ SQLite 데이터베이스를 삭제했습니다.'));
  log('  다음 `onboarding start` 실행 시 위저드가 다시 표시됩니다.');
  return { deleted: true };
}
