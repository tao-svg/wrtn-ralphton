import type { Verification } from '@onboarding/shared';
import { execa } from 'execa';

export interface ProbeOutput {
  stdout: string;
  exitCode: number;
}

export type ProbeRunner = (command: string) => Promise<ProbeOutput>;

export interface ProbeResult {
  status: 'PASS' | 'FAIL';
}

const DEFAULT_TIMEOUT_MS = 5_000;

export const defaultProbeRunner: ProbeRunner = async (command) => {
  const result = await execa(command, {
    shell: true,
    timeout: DEFAULT_TIMEOUT_MS,
    reject: false,
  });
  return {
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    exitCode: typeof result.exitCode === 'number' ? result.exitCode : 1,
  };
};

export async function runProbe(
  verification: Verification,
  runner: ProbeRunner,
): Promise<ProbeResult> {
  if (verification.type === 'command') {
    return runCommandProbe(verification.command, verification.expect_contains, runner);
  }
  return runProcessCheckProbe(verification.process_name, runner);
}

async function runCommandProbe(
  command: string,
  expectContains: string | undefined,
  runner: ProbeRunner,
): Promise<ProbeResult> {
  let output: ProbeOutput;
  try {
    output = await runner(command);
  } catch {
    return { status: 'FAIL' };
  }
  if (output.exitCode !== 0) {
    return { status: 'FAIL' };
  }
  if (expectContains && !output.stdout.includes(expectContains)) {
    return { status: 'FAIL' };
  }
  return { status: 'PASS' };
}

async function runProcessCheckProbe(
  processName: string,
  runner: ProbeRunner,
): Promise<ProbeResult> {
  let output: ProbeOutput;
  try {
    output = await runner(`pgrep ${processName}`);
  } catch {
    return { status: 'FAIL' };
  }
  if (output.exitCode !== 0) {
    return { status: 'FAIL' };
  }
  if (output.stdout.trim().length === 0) {
    return { status: 'FAIL' };
  }
  return { status: 'PASS' };
}
