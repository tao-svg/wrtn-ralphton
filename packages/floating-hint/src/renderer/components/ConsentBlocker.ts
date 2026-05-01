import type { UiMode } from '../state/machine.js';
import { el, text, type ElementVNode } from '../vnode.js';

export interface ConsentBlockerProps {
  mode: UiMode;
  onOpenSettings: () => void;
}

const COPY: Record<'screen_recording' | 'consent_required', string> = {
  screen_recording:
    '화면 기록 권한이 필요합니다. 시스템 설정 > 개인 정보 보호 > 화면 기록에서 onboarding을 허용해주세요.',
  consent_required:
    'Anthropic 전송 동의가 필요합니다. `onboarding` CLI 위저드를 다시 실행해 동의를 갱신해주세요.',
};

export function ConsentBlocker(
  props: ConsentBlockerProps,
): ElementVNode | null {
  if (props.mode.kind !== 'consent-blocked') return null;
  const message = COPY[props.mode.reason];
  return el(
    'div',
    {
      className: 'consent-blocker',
      role: 'alert',
      dataset: { testid: 'consent-blocker' },
    },
    [
      el(
        'p',
        { className: 'consent-blocker__message' },
        [text(message)],
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'btn-open-settings',
          dataset: { testid: 'btn-open-settings' },
          on: { click: () => props.onOpenSettings() },
        },
        [text('설정 열기')],
      ),
    ],
  );
}
