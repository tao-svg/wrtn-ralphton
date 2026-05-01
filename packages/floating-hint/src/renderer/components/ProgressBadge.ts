import { el, text, type ElementVNode } from '../vnode.js';

export interface ProgressBadgeProps {
  stepIndex: number;
  totalSteps: number;
}

export function ProgressBadge(props: ProgressBadgeProps): ElementVNode {
  if (props.totalSteps <= 0) {
    return el(
      'div',
      { className: 'progress-badge', hidden: true, dataset: { testid: 'progress-badge' } },
      [],
    );
  }
  const current = Math.min(props.totalSteps, Math.max(1, props.stepIndex + 1));
  return el(
    'div',
    {
      className: 'progress-badge',
      dataset: { testid: 'progress-badge' },
      ariaLive: 'polite',
    },
    [text(`단계 ${current}/${props.totalSteps}`)],
  );
}
