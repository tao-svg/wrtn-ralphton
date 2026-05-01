import type { ChecklistFile, Verification } from '@onboarding/shared';
import { execa } from 'execa';
import type { Logger } from 'pino';

import type { DatabaseInstance } from '../db/index.js';

export const VERIFY_TIMEOUT_MS = 30_000;
const STDOUT_DETAILS_MAX_BYTES = 1024;

export interface VerifyOutput {
  stdout: string;
  exitCode: number;
  timedOut: boolean;
}

export type VerifyRunner = (command: string) => Promise<VerifyOutput>;

export interface VerifyResult {
  status: 'pass' | 'fail';
  details: string;
}

export const defaultVerifyRunner: VerifyRunner = async (command) => {
  const result = await execa(command, {
    shell: true,
    timeout: VERIFY_TIMEOUT_MS,
    reject: false,
  });
  return {
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    exitCode: typeof result.exitCode === 'number' ? result.exitCode : 1,
    timedOut: result.timedOut === true,
  };
};

export class ItemNotFoundError extends Error {
  readonly code = 'item_not_found';
  constructor(public readonly itemId: string) {
    super(`item_not_found: ${itemId}`);
    this.name = 'ItemNotFoundError';
  }
}

export class VerificationMissingError extends Error {
  readonly code = 'verification_missing';
  constructor(public readonly itemId: string) {
    super(`verification_missing: ${itemId}`);
    this.name = 'VerificationMissingError';
  }
}

export interface RunVerifyOptions {
  checklist: ChecklistFile;
  db: DatabaseInstance;
  verification?: Verification;
  runner?: VerifyRunner;
  now?: () => number;
  logger?: Logger;
}

export async function runVerify(
  itemId: string,
  options: RunVerifyOptions,
): Promise<VerifyResult> {
  const item = options.checklist.items.find((i) => i.id === itemId);
  if (!item) throw new ItemNotFoundError(itemId);

  const verification = options.verification ?? item.verification;
  if (!verification) throw new VerificationMissingError(itemId);

  const runner = options.runner ?? defaultVerifyRunner;
  const now = options.now ?? Date.now;

  const result = await runVerificationProbe(verification, runner);
  options.logger?.info(
    { item_id: itemId, status: result.status },
    'verify_result',
  );

  if (result.status === 'pass') {
    markCompleted(options.db, itemId, now());
  } else {
    bumpAttemptCount(options.db, itemId);
  }

  return result;
}

async function runVerificationProbe(
  verification: Verification,
  runner: VerifyRunner,
): Promise<VerifyResult> {
  if (verification.type === 'command') {
    return runCommandVerify(
      verification.command,
      verification.expect_contains,
      runner,
    );
  }
  return runProcessCheckVerify(verification.process_name, runner);
}

async function runCommandVerify(
  command: string,
  expectContains: string | undefined,
  runner: VerifyRunner,
): Promise<VerifyResult> {
  let output: VerifyOutput;
  try {
    output = await runner(command);
  } catch (err) {
    return {
      status: 'fail',
      details: `command threw: ${errorMessage(err)}`,
    };
  }

  if (output.timedOut) {
    return {
      status: 'fail',
      details: `timeout after ${VERIFY_TIMEOUT_MS / 1000}s; ${stdoutSnippet(output.stdout)}`,
    };
  }

  if (output.exitCode !== 0) {
    return {
      status: 'fail',
      details: `command failed (exit ${output.exitCode}); ${stdoutSnippet(output.stdout)}`,
    };
  }

  if (expectContains && !output.stdout.includes(expectContains)) {
    return {
      status: 'fail',
      details: `expected stdout to contain ${JSON.stringify(expectContains)} (exit 0); got ${stdoutSnippet(output.stdout)}`,
    };
  }

  return {
    status: 'pass',
    details: `command succeeded (exit 0)`,
  };
}

async function runProcessCheckVerify(
  processName: string,
  runner: VerifyRunner,
): Promise<VerifyResult> {
  const command = `pgrep ${processName}`;
  let output: VerifyOutput;
  try {
    output = await runner(command);
  } catch (err) {
    return {
      status: 'fail',
      details: `pgrep threw: ${errorMessage(err)}`,
    };
  }

  if (output.timedOut) {
    return {
      status: 'fail',
      details: `timeout after ${VERIFY_TIMEOUT_MS / 1000}s while probing process ${processName}`,
    };
  }

  if (output.exitCode !== 0 || output.stdout.trim().length === 0) {
    return {
      status: 'fail',
      details: `process ${processName} not running (exit ${output.exitCode})`,
    };
  }

  return {
    status: 'pass',
    details: `process ${processName} running (pid ${output.stdout.trim().split(/\s+/)[0]})`,
  };
}

function stdoutSnippet(stdout: string): string {
  const trimmed = stdout.length > 0 ? stdout : '<empty>';
  if (Buffer.byteLength(trimmed, 'utf8') <= STDOUT_DETAILS_MAX_BYTES) {
    return `stdout=${JSON.stringify(trimmed)}`;
  }
  // Truncate by bytes (safe for ASCII; for multibyte we may cut a char short
  // but the snippet is purely informational).
  const buf = Buffer.from(trimmed, 'utf8').subarray(0, STDOUT_DETAILS_MAX_BYTES);
  return `stdout=${JSON.stringify(buf.toString('utf8'))}<truncated>`;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function markCompleted(
  db: DatabaseInstance,
  itemId: string,
  now: number,
): void {
  db.prepare(
    `INSERT INTO item_states
       (item_id, status, current_step, started_at, completed_at, attempt_count)
     VALUES (@item_id, 'completed', NULL, NULL, @now, 1)
     ON CONFLICT(item_id) DO UPDATE SET
       status        = 'completed',
       completed_at  = @now,
       attempt_count = item_states.attempt_count + 1`,
  ).run({ item_id: itemId, now });
}

function bumpAttemptCount(db: DatabaseInstance, itemId: string): void {
  db.prepare(
    `INSERT INTO item_states
       (item_id, status, current_step, started_at, completed_at, attempt_count)
     VALUES (@item_id, 'pending', NULL, NULL, NULL, 1)
     ON CONFLICT(item_id) DO UPDATE SET
       attempt_count = item_states.attempt_count + 1`,
  ).run({ item_id: itemId });
}
