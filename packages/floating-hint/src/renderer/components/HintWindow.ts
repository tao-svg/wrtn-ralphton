import type { AppState } from '../state/machine.js';
import { el, type ElementVNode } from '../vnode.js';
import { ActionButtons } from './ActionButtons.js';
import { ConsentBlocker } from './ConsentBlocker.js';
import { ProgressBadge } from './ProgressBadge.js';
import { RatePausedBanner } from './RatePausedBanner.js';
import { ResponsePanel } from './ResponsePanel.js';
import { RetryBanner } from './RetryBanner.js';

export interface HintWindowProps {
  state: AppState;
  now: number;
  onGuide: () => void;
  onVerify: () => void;
  onRetry: () => void;
  onOpenSettings: () => void;
}

export function HintWindow(props: HintWindowProps): ElementVNode {
  const { state, now, onGuide, onVerify, onRetry, onOpenSettings } = props;
  const banner =
    RetryBanner({ mode: state.mode, onRetry }) ??
    RatePausedBanner({ mode: state.mode, now }) ??
    ConsentBlocker({ mode: state.mode, onOpenSettings });

  const children: ElementVNode[] = [
    ProgressBadge({
      stepIndex: state.context.stepIndex,
      totalSteps: state.context.totalSteps,
    }),
    ResponsePanel({ mode: state.mode }),
    ActionButtons({ mode: state.mode, onGuide, onVerify }),
  ];
  if (banner) children.push(banner);

  return el(
    'div',
    {
      className: 'hint-window',
      dataset: { testid: 'hint-window' },
    },
    children,
  );
}
