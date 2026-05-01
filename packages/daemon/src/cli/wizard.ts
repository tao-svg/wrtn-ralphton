import type { ConsentType } from '@onboarding/shared';
import pc from 'picocolors';

import type { DatabaseInstance } from '../db/index.js';
import { launchSystemPanel as defaultLaunchSystemPanel } from '../p5-system-panel/index.js';
import { DEFAULT_BASE_URL } from './paths.js';

export type PromptInput = (q: { message: string }) => Promise<string>;
export type PromptConfirm = (q: { message: string }) => Promise<boolean>;
export type PromptPress = (q: { message: string }) => Promise<void>;

export interface WizardDeps {
  db: DatabaseInstance;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  log?: (line: string) => void;
  promptInput: PromptInput;
  promptConfirm: PromptConfirm;
  promptPress: PromptPress;
  launchSystemPanel?: (url: string) => Promise<void>;
  platform?: NodeJS.Platform;
  now?: () => number;
}

export interface WizardResult {
  skipped: boolean;
}

const SCREEN_RECORDING_PANEL_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';

export function profileExists(db: DatabaseInstance): boolean {
  const row = db
    .prepare('SELECT employee_id FROM profile LIMIT 1')
    .get() as { employee_id?: string } | undefined;
  return Boolean(row?.employee_id);
}

interface ProfileInputs {
  name: string;
  email: string;
  employeeId: string;
  role: string;
  phone: string;
}

async function promptProfile(
  promptInput: PromptInput,
): Promise<ProfileInputs> {
  const name = (await promptInput({ message: '이름을 입력하세요' })).trim();
  const email = (await promptInput({ message: '이메일을 입력하세요' })).trim();
  const employeeId = (
    await promptInput({ message: '사번 (Employee ID)을 입력하세요' })
  ).trim();
  const role = (await promptInput({ message: '직무를 입력하세요' })).trim();
  const phone = (await promptInput({ message: '전화번호를 입력하세요' })).trim();
  return { name, email, employeeId, role, phone };
}

function insertProfile(
  db: DatabaseInstance,
  inputs: ProfileInputs,
  now: number,
): void {
  db.prepare(
    'INSERT INTO profile (employee_id, email, name, created_at) VALUES (?, ?, ?, ?)',
  ).run(inputs.employeeId, inputs.email, inputs.name, now);
}

async function postConsent(
  fetchImpl: typeof globalThis.fetch,
  baseUrl: string,
  type: ConsentType,
  granted: boolean,
): Promise<void> {
  const res = await fetchImpl(`${baseUrl}/api/consents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ consent_type: type, granted }),
  });
  if (!res.ok) {
    throw new Error(
      `consent_post_failed: ${type} status=${res.status}`,
    );
  }
}

export async function runWizard(deps: WizardDeps): Promise<WizardResult> {
  const log = deps.log ?? ((line: string) => console.log(line));
  const baseUrl = deps.baseUrl ?? DEFAULT_BASE_URL;
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const platform = deps.platform ?? process.platform;
  const launch = deps.launchSystemPanel ?? ((url) =>
    defaultLaunchSystemPanel(url, { platform }));
  const now = deps.now ?? Date.now;

  if (profileExists(deps.db)) {
    return { skipped: true };
  }

  log(pc.bold('환영합니다! 입사 첫날 환경 설정을 시작합니다.'));
  log('');

  log(pc.bold('1) 사용자 정보를 입력하세요.'));
  const inputs = await promptProfile(deps.promptInput);
  insertProfile(deps.db, inputs, now());
  log(pc.green('  ✓ 프로필이 저장되었습니다.'));
  log('');

  log(pc.bold('2) Screen Recording 권한 부여'));
  if (platform === 'darwin') {
    log('  시스템 설정 → 개인정보 보호 및 보안 → 화면 기록 패널을 엽니다.');
    log('  목록에서 onboarding을 찾아 권한을 부여한 뒤 ENTER를 눌러주세요.');
    try {
      await launch(SCREEN_RECORDING_PANEL_URL);
    } catch (err) {
      log(
        pc.yellow(
          `  시스템 설정을 자동으로 열지 못했습니다: ${(err as Error).message}`,
        ),
      );
    }
    await deps.promptPress({ message: '권한 부여 후 ENTER 키를 눌러주세요.' });
    log(pc.green('  ✓ Screen Recording 권한 안내를 완료했습니다.'));
  } else {
    log(pc.yellow('  현재 macOS가 아닙니다. 이 단계를 건너뜁니다.'));
  }
  log('');

  log(pc.bold('3) Anthropic 전송 동의'));
  log('  화면 캡처 이미지를 Anthropic Claude API로 전송하여 안내를 생성합니다.');
  log('  이미지는 응답 직후 즉시 파기되며 디스크에 저장되지 않습니다.');
  const anthropicGranted = await deps.promptConfirm({
    message: 'Anthropic 전송에 동의합니까?',
  });
  await postConsent(
    fetchImpl,
    baseUrl,
    'anthropic_transmission',
    anthropicGranted,
  );
  if (anthropicGranted) {
    log(pc.green('  ✓ Anthropic 전송 동의가 기록되었습니다.'));
  } else {
    log(
      pc.yellow(
        '  동의가 거부되었습니다. AI Vision 기능 없이 결정론적 자동화만 사용합니다.',
      ),
    );
  }

  return { skipped: false };
}
