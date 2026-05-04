import type { AppState } from '../state/machine.js';
import { el, type ElementVNode } from '../vnode.js';
import { ActionButtons } from './ActionButtons.js';
import { ConsentBlocker } from './ConsentBlocker.js';
import { ProgressBadge } from './ProgressBadge.js';
import { RatePausedBanner } from './RatePausedBanner.js';
import { ResponsePanel } from './ResponsePanel.js';
import { RetryBanner } from './RetryBanner.js';
import { ScenarioPanel } from './ScenarioPanel.js';

export interface HintWindowProps {
  state: AppState;
  now: number;
  onGuide: () => void;
  onRetry: () => void;
  onOpenSettings: () => void;
  onNextStep: () => void;
  onOpenUrl: () => void;
}

export function HintWindow(props: HintWindowProps): ElementVNode {
  const {
    state,
    now,
    onGuide,
    onRetry,
    onOpenSettings,
    onNextStep,
    onOpenUrl,
  } = props;
  const banner =
    RetryBanner({ mode: state.mode, onRetry }) ??
    RatePausedBanner({ mode: state.mode, now }) ??
    ConsentBlocker({ mode: state.mode, onOpenSettings });

  const totalSteps = state.context.totalSteps;
  const isLastStep =
    totalSteps > 0 ? state.context.stepIndex >= totalSteps - 1 : false;

  const children: ElementVNode[] = [
    ProgressBadge({
      stepIndex: state.context.stepIndex,
      totalSteps: state.context.totalSteps,
    }),
  ];
  const scenario = ScenarioPanel({
    activeItem: state.activeItem,
    context: state.context,
    onOpenUrl,
  });
  if (scenario) children.push(scenario);
  children.push(ResponsePanel({ mode: state.mode }));
  children.push(
    ActionButtons({ mode: state.mode, onGuide, onNext: onNextStep, isLastStep }),
  );
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
