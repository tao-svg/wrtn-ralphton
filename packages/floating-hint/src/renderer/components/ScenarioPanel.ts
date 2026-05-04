import type { ActiveItem, UiContext } from '../state/machine.js';
import { el, text, type ElementVNode } from '../vnode.js';

export interface ScenarioPanelProps {
  activeItem?: ActiveItem;
  context: UiContext;
}

export function ScenarioPanel(props: ScenarioPanelProps): ElementVNode | null {
  const { activeItem, context } = props;
  if (!activeItem) return null;

  const steps = activeItem.ai_coaching?.steps ?? [];
  const currentStep =
    steps.find((s) => s.id === context.stepId) ?? steps[context.stepIndex] ?? steps[0];

  const children: ElementVNode[] = [
    el(
      'div',
      { className: 'scenario-title', dataset: { testid: 'scenario-title' } },
      [text(activeItem.title)],
    ),
  ];

  if (activeItem.ai_coaching?.overall_goal) {
    children.push(
      el(
        'div',
        { className: 'scenario-goal' },
        [text(activeItem.ai_coaching.overall_goal)],
      ),
    );
  }

  if (currentStep) {
    const stepCount = steps.length;
    const stepIdx = Math.max(
      0,
      steps.findIndex((s) => s.id === currentStep.id),
    );
    children.push(
      el('div', { className: 'scenario-step-header' }, [
        text(`단계 ${stepIdx + 1}/${stepCount} · ${currentStep.id}`),
      ]),
    );
    children.push(
      el(
        'div',
        { className: 'scenario-step-intent' },
        [text(currentStep.intent)],
      ),
    );
    if (currentStep.success_criteria) {
      children.push(
        el('div', { className: 'scenario-step-success' }, [
          text(`✓ 성공 기준: ${currentStep.success_criteria}`),
        ]),
      );
    }
  }

  return el(
    'div',
    {
      className: 'scenario-panel',
      dataset: { testid: 'scenario-panel' },
    },
    children,
  );
}
