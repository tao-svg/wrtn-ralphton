import type { ConsentRecord, ConsentType, ItemState } from '@onboarding/shared';
import pc from 'picocolors';

import { DEFAULT_BASE_URL } from './paths.js';

export interface ChecklistItemSummary extends ItemState {
  title: string;
}

export interface ChecklistResponse {
  items: ChecklistItemSummary[];
}

export type ConsentsResponse = Record<ConsentType, ConsentRecord>;

export interface RateLimitResponse {
  current_hour_calls: number;
  state: 'ok' | 'paused';
  reset_at: number;
}

export interface DaemonStatusSnapshot {
  checklist: ChecklistResponse;
  consents: ConsentsResponse;
  rateLimit: RateLimitResponse;
}

export class DaemonUnreachableError extends Error {
  readonly code = 'daemon_unreachable';
  constructor(public readonly baseUrl: string, cause?: unknown) {
    super(`daemon_unreachable: ${baseUrl}`);
    this.name = 'DaemonUnreachableError';
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export interface FetchStatusDeps {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

async function getJson<T>(
  fetchImpl: typeof globalThis.fetch,
  url: string,
): Promise<T> {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`request_failed: ${url} status=${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchDaemonStatus(
  deps: FetchStatusDeps = {},
): Promise<DaemonStatusSnapshot> {
  const baseUrl = deps.baseUrl ?? DEFAULT_BASE_URL;
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  try {
    const [checklist, consents, rateLimit] = await Promise.all([
      getJson<ChecklistResponse>(fetchImpl, `${baseUrl}/api/checklist`),
      getJson<ConsentsResponse>(fetchImpl, `${baseUrl}/api/consents`),
      getJson<RateLimitResponse>(fetchImpl, `${baseUrl}/api/vision/rate-limit`),
    ]);
    return { checklist, consents, rateLimit };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('request_failed')) {
      throw err;
    }
    throw new DaemonUnreachableError(baseUrl, err);
  }
}

const STATUS_LABELS: Record<ItemState['status'], string> = {
  pending: '대기',
  in_progress: '진행 중',
  completed: '완료',
  skipped: '건너뜀',
  blocked: '차단됨',
};

function statusBadge(status: ItemState['status']): string {
  switch (status) {
    case 'completed':
      return pc.green('✓');
    case 'in_progress':
      return pc.yellow('▶');
    case 'blocked':
      return pc.red('✗');
    case 'skipped':
      return pc.dim('-');
    case 'pending':
    default:
      return pc.dim('·');
  }
}

export function renderStatus(
  snapshot: DaemonStatusSnapshot,
  log: (line: string) => void,
): void {
  log(pc.bold('체크리스트'));
  for (const item of snapshot.checklist.items) {
    const badge = statusBadge(item.status);
    const label = STATUS_LABELS[item.status];
    log(`  ${badge} ${item.title} ${pc.dim(`(${label})`)}`);
  }

  log('');
  log(pc.bold('동의 상태'));
  log(
    `  Screen Recording: ${formatGranted(snapshot.consents.screen_recording)}`,
  );
  log(
    `  Anthropic 전송: ${formatGranted(snapshot.consents.anthropic_transmission)}`,
  );

  log('');
  log(pc.bold('Vision 가드레일'));
  const rl = snapshot.rateLimit;
  const stateLabel = rl.state === 'ok' ? pc.green('정상') : pc.red('일시정지');
  log(`  현재 시간 호출: ${rl.current_hour_calls}회 (${stateLabel})`);
}

function formatGranted(record: ConsentRecord): string {
  return record.granted ? pc.green('부여됨') : pc.red('미부여');
}

export interface RunStatusDeps extends FetchStatusDeps {
  log?: (line: string) => void;
}

export async function runStatus(
  deps: RunStatusDeps = {},
): Promise<DaemonStatusSnapshot> {
  const log = deps.log ?? ((line: string) => console.log(line));
  try {
    const snapshot = await fetchDaemonStatus(deps);
    renderStatus(snapshot, log);
    return snapshot;
  } catch (err) {
    if (err instanceof DaemonUnreachableError) {
      log(
        pc.red(
          '데몬이 실행 중이 아닙니다. `onboarding start`로 데몬을 먼저 기동하세요.',
        ),
      );
    } else {
      log(pc.red(`상태 조회 실패: ${(err as Error).message}`));
    }
    throw err;
  }
}
