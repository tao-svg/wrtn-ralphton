import type { UiMode } from '../state/machine.js';
import { el, text, type ElementVNode } from '../vnode.js';

export interface ResponsePanelProps {
  mode: UiMode;
}

const SCROLL_THRESHOLD = 200;

function panel(
  children: ElementVNode[],
  scrollable: boolean,
): ElementVNode {
  return el(
    'div',
    {
      className: 'response-panel',
      role: 'region',
      ariaLive: 'polite',
      dataset: {
        testid: 'response-panel',
        scrollable: scrollable ? 'true' : 'false',
      },
    },
    children,
  );
}

function guideContent(message: string, confidence: string): ElementVNode[] {
  return [
    el(
      'p',
      { className: 'response-message', dataset: { testid: 'response-message' } },
      [text(message)],
    ),
    el(
      'span',
      {
        className: `response-confidence response-confidence--${confidence}`,
        dataset: { testid: 'response-confidence' },
      },
      [text(`confidence: ${confidence}`)],
    ),
  ];
}

function verifyContent(
  status: string,
  reasoning: string,
  hint?: string,
): ElementVNode[] {
  const children: ElementVNode[] = [
    el(
      'span',
      {
        className: `response-status response-status--${status}`,
        dataset: { testid: 'response-status' },
      },
      [text(`status: ${status}`)],
    ),
    el(
      'p',
      { className: 'response-message', dataset: { testid: 'response-message' } },
      [text(reasoning)],
    ),
  ];
  if (hint) {
    children.push(
      el(
        'p',
        { className: 'response-hint', dataset: { testid: 'response-hint' } },
        [text(hint)],
      ),
    );
  }
  return children;
}

export function ResponsePanel(props: ResponsePanelProps): ElementVNode {
  const mode = props.mode;
  if (mode.kind === 'showing-guide') {
    return panel(
      guideContent(mode.result.message, mode.result.confidence),
      mode.result.message.length > SCROLL_THRESHOLD,
    );
  }
  if (mode.kind === 'showing-verify') {
    return panel(
      verifyContent(
        mode.result.status,
        mode.result.reasoning,
        mode.result.next_action_hint,
      ),
      mode.result.reasoning.length > SCROLL_THRESHOLD,
    );
  }
  if (mode.kind === 'loading') {
    return panel(
      [
        el(
          'span',
          {
            className: 'response-loading',
            dataset: { testid: 'response-loading' },
            role: 'status',
          },
          [text('AI에 요청 중…')],
        ),
      ],
      false,
    );
  }
  // idle / error / rate-paused / consent-blocked: empty placeholder.
  return panel(
    [
      el(
        'span',
        {
          className: 'response-empty',
          dataset: { testid: 'response-empty' },
        },
        [text('아직 안내가 없습니다. 버튼을 눌러주세요.')],
      ),
    ],
    false,
  );
}
