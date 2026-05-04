import type { ActiveItem, UiContext } from '../state/machine.js';
import { el, text, type ElementVNode } from '../vnode.js';

export interface ScenarioPanelProps {
  activeItem?: ActiveItem;
  context: UiContext;
  onOpenUrl: () => void;
}

function extractUrl(command: string | undefined): string | undefined {
  if (!command) return undefined;
  const m = command.match(/https?:\/\/[^\s'"]+/);
  return m?.[0];
}

function goalSection(
  activeItem: ActiveItem,
  url: string | undefined,
  onOpenUrl: () => void,
): ElementVNode {
  const children: ElementVNode[] = [
    el('div', { className: 'goal-header' }, [
      el('span', { className: 'goal-icon' }, [text('📌')]),
      el('span', { className: 'goal-title', dataset: { testid: 'scenario-title' } }, [
        text(activeItem.title),
      ]),
    ]),
  ];

  if (activeItem.ai_coaching?.overall_goal) {
    children.push(
      el(
        'div',
        { className: 'goal-text' },
        [text(activeItem.ai_coaching.overall_goal)],
      ),
    );
  }

  if (url) {
    children.push(
      el('div', { className: 'goal-link' }, [
        el(
          'button',
          {
            type: 'button',
            className: 'scenario-link-btn',
            dataset: { testid: 'btn-open-url' },
            on: { click: () => onOpenUrl() },
          },
          [text('🔗 페이지 열기')],
        ),
        el('span', { className: 'goal-url' }, [text(url)]),
      ]),
    );
  }

  return el(
    'section',
    { className: 'goal-section', dataset: { testid: 'goal-section' } },
    children,
  );
}

function stepSection(
  step: { id: string; intent: string; success_criteria: string },
  stepIdx: number,
  stepCount: number,
): ElementVNode {
  return el(
    'section',
    { className: 'step-section', dataset: { testid: 'step-section' } },
    [
      el('div', { className: 'step-header' }, [
        el('span', { className: 'step-counter' }, [
          text(`단계 ${stepIdx + 1} / ${stepCount}`),
        ]),
        el('span', { className: 'step-id' }, [text(step.id)]),
      ]),

      el('div', { className: 'step-intent-block' }, [
        el('div', { className: 'step-label' }, [text('📍 무엇을 할까요')]),
        el(
          'div',
          { className: 'step-intent', dataset: { testid: 'step-intent' } },
          [text(step.intent)],
        ),
      ]),

      el('div', { className: 'step-success-block' }, [
        el('div', { className: 'step-label' }, [text('✅ 성공 기준')]),
        el(
          'div',
          { className: 'step-success', dataset: { testid: 'step-success' } },
          [text(step.success_criteria)],
        ),
      ]),
    ],
  );
}

export function ScenarioPanel(props: ScenarioPanelProps): ElementVNode | null {
  const { activeItem, context, onOpenUrl } = props;
  if (!activeItem) return null;

  const steps = activeItem.ai_coaching?.steps ?? [];
  const currentStep =
    steps.find((s) => s.id === context.stepId) ?? steps[context.stepIndex] ?? steps[0];
  const stepIdx = currentStep
    ? Math.max(0, steps.findIndex((s) => s.id === currentStep.id))
    : 0;
  const stepCount = steps.length;
  const url = extractUrl(activeItem.clipboard_inject?.command);

  const sections: ElementVNode[] = [goalSection(activeItem, url, onOpenUrl)];
  if (currentStep) {
    sections.push(stepSection(currentStep, stepIdx, stepCount));
  }

  return el(
    'div',
    { className: 'scenario-panel', dataset: { testid: 'scenario-panel' } },
    sections,
  );
}
