import type { UiMode } from '../state/machine.js';
import { el, text, type ElementVNode } from '../vnode.js';

export interface RetryBannerProps {
  mode: UiMode;
  onRetry: () => void;
}

export function RetryBanner(props: RetryBannerProps): ElementVNode | null {
  if (props.mode.kind !== 'error') return null;
  const status = props.mode.status;
  const message = props.mode.message;
  return el(
    'div',
    {
      className: 'retry-banner',
      role: 'alert',
      dataset: { testid: 'retry-banner' },
    },
    [
      el(
        'p',
        { className: 'retry-banner__message' },
        [text(`오류 ${status}: ${message}`)],
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'btn-retry',
          dataset: { testid: 'btn-retry' },
          on: { click: () => props.onRetry() },
        },
        [text('🔄 재시도')],
      ),
    ],
  );
}
