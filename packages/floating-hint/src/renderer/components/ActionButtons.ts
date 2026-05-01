import type { UiMode } from '../state/machine.js';
import { el, text, type ElementVNode } from '../vnode.js';

export interface ActionButtonsProps {
  mode: UiMode;
  onGuide: () => void;
  onVerify: () => void;
}

function isDisabled(mode: UiMode): boolean {
  return mode.kind === 'loading' || mode.kind === 'consent-blocked';
}

function spinner(testid: string): ElementVNode {
  return el(
    'span',
    {
      className: 'spinner',
      dataset: { testid },
      ariaLabel: '로딩 중',
      role: 'status',
    },
    [text('⏳')],
  );
}

function button(
  testid: string,
  label: string,
  onClick: () => void,
  disabled: boolean,
  showSpinner: boolean,
): ElementVNode {
  const children = showSpinner
    ? [spinner(`spinner-${testid.replace('btn-', '')}`), text(' '), text(label)]
    : [text(label)];
  return el(
    'button',
    {
      type: 'button',
      className: 'action-btn',
      disabled,
      dataset: { testid },
      on: { click: () => onClick() },
    },
    children,
  );
}

export function ActionButtons(props: ActionButtonsProps): ElementVNode {
  const disabled = isDisabled(props.mode);
  const loadingPending =
    props.mode.kind === 'loading' ? props.mode.pending : null;
  return el(
    'div',
    { className: 'action-buttons', dataset: { testid: 'action-buttons' } },
    [
      button(
        'btn-guide',
        '📋 안내 요청',
        props.onGuide,
        disabled,
        loadingPending === 'guide',
      ),
      button(
        'btn-verify',
        '✓ 진행 확인',
        props.onVerify,
        disabled,
        loadingPending === 'verify',
      ),
    ],
  );
}
