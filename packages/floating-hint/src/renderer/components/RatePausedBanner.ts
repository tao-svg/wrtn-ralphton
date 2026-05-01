import type { UiMode } from '../state/machine.js';
import { el, text, type ElementVNode } from '../vnode.js';

export interface RatePausedBannerProps {
  mode: UiMode;
  now: number;
}

function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

export function RatePausedBanner(
  props: RatePausedBannerProps,
): ElementVNode | null {
  if (props.mode.kind !== 'rate-paused') return null;
  const remaining = props.mode.resetAt - props.now;
  const display = formatCountdown(remaining);
  return el(
    'div',
    {
      className: 'rate-paused-banner',
      role: 'alert',
      dataset: { testid: 'rate-paused-banner' },
    },
    [
      el(
        'p',
        { className: 'rate-paused-banner__message' },
        [text('AI Vision 호출이 일시 정지되었습니다. 다음 시간대까지 정지됩니다.')],
      ),
      el(
        'span',
        { className: 'rate-countdown', dataset: { testid: 'rate-countdown' } },
        [text(display)],
      ),
    ],
  );
}
