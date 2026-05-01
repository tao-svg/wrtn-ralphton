import { spawn as nodeSpawn } from 'node:child_process';

import { confirm, input } from '@inquirer/prompts';
import { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';

import { openDatabase } from '../db/index.js';
import { migrate } from '../db/migrate.js';
import {
  defaultDbFilePath,
  defaultPidFilePath,
  DEFAULT_BASE_URL,
} from './paths.js';
import { runReset } from './reset.js';
import { runStart, type SpawnFn, type SpawnedProcess } from './start.js';
import { fetchDaemonStatus, renderStatus, runStatus } from './status.js';
import { runStop } from './stop.js';
import { runWizard, type WizardResult } from './wizard.js';

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

const spawnFn: SpawnFn = (command, args, options) => {
  const child = nodeSpawn(command, args, options);
  return { pid: child.pid, unref: () => child.unref() } satisfies SpawnedProcess;
};

async function waitForReady(baseUrl: string): Promise<boolean> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/checklist`);
      if (res.ok) return true;
    } catch {
      /* daemon still booting */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function pressEnter(q: { message: string }): Promise<void> {
  await input({ message: `${q.message} (ENTER)` });
}

async function startCommand(): Promise<void> {
  await runStart({
    pidFilePath: defaultPidFilePath(),
    dbFilePath: defaultDbFilePath(),
    spawn: spawnFn,
    runWizard: async ({ dbFilePath }): Promise<WizardResult> => {
      const db = openDatabase(dbFilePath);
      try {
        migrate(db);
        return await runWizard({
          db,
          baseUrl: DEFAULT_BASE_URL,
          promptInput: input,
          promptConfirm: confirm,
          promptPress: pressEnter,
        });
      } finally {
        db.close();
      }
    },
    isProcessAlive,
    waitForReady,
    now: Date.now,
  });
}

async function statusCommand(): Promise<void> {
  const spinner = ora({ text: '데몬 상태 확인 중...' }).start();
  try {
    const snapshot = await fetchDaemonStatus({ baseUrl: DEFAULT_BASE_URL });
    spinner.stop();
    renderStatus(snapshot, (line) => console.log(line));
  } catch (err) {
    spinner.stop();
    // Re-render to print the failure log line through runStatus error path.
    try {
      await runStatus({ baseUrl: DEFAULT_BASE_URL });
    } catch {
      /* runStatus already printed */
    }
    process.exitCode = 1;
    throw err;
  }
}

async function stopCommand(): Promise<void> {
  await runStop({
    pidFilePath: defaultPidFilePath(),
    kill: (pid, signal) => process.kill(pid, signal),
    isProcessAlive,
  });
}

async function resetCommand(opts: { yes?: boolean }): Promise<void> {
  await runReset({
    dbFilePath: defaultDbFilePath(),
    yes: Boolean(opts.yes),
    promptConfirm: confirm,
  });
}

export function buildCli(): Command {
  const program = new Command();
  program
    .name('onboarding')
    .description(pc.bold('Onboarding Agent CLI (PRD-MVP-SLIM v0.10 §6.2 A)'))
    .version('0.1.0');

  program
    .command('start')
    .description('데몬을 기동하고 첫 실행 위저드를 실행합니다.')
    .action(startCommand);

  program
    .command('status')
    .description('체크리스트, 동의, Vision 가드레일 상태를 출력합니다.')
    .action(statusCommand);

  program
    .command('stop')
    .description('실행 중인 데몬을 종료합니다.')
    .action(stopCommand);

  program
    .command('reset')
    .description('SQLite 데이터를 삭제하고 위저드를 재실행 가능 상태로 만듭니다.')
    .option('-y, --yes', '확인 프롬프트 없이 즉시 초기화합니다.', false)
    .action(resetCommand);

  return program;
}

async function main(): Promise<void> {
  const program = buildCli();
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(pc.red(`오류: ${(err as Error).message}`));
  process.exit(1);
});
