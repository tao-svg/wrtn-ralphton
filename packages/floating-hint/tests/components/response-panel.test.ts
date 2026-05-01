import { describe, it, expect } from 'vitest';
import { ResponsePanel } from '../../src/renderer/components/ResponsePanel.js';
import { findByTestId, textContent } from '../../src/renderer/vnode.js';

describe('ResponsePanel', () => {
  it('shows guide message + confidence label when in showing-guide mode', () => {
    const tree = ResponsePanel({
      mode: {
        kind: 'showing-guide',
        result: {
          type: 'guide',
          message: '잠금 아이콘을 클릭하세요',
          confidence: 'high',
        },
      },
    });
    const message = findByTestId(tree, 'response-message');
    const confidence = findByTestId(tree, 'response-confidence');
    expect(textContent(message!)).toBe('잠금 아이콘을 클릭하세요');
    expect(textContent(confidence!)).toContain('high');
  });

  it('shows pass result for verify pass', () => {
    const tree = ResponsePanel({
      mode: {
        kind: 'showing-verify',
        result: {
          type: 'verify',
          status: 'pass',
          reasoning: '완료됨',
        },
      },
    });
    expect(findByTestId(tree, 'response-status')).not.toBeNull();
    expect(textContent(findByTestId(tree, 'response-status')!)).toContain('pass');
    expect(textContent(findByTestId(tree, 'response-message')!)).toContain('완료됨');
  });

  it('shows next_action_hint on verify fail', () => {
    const tree = ResponsePanel({
      mode: {
        kind: 'showing-verify',
        result: {
          type: 'verify',
          status: 'fail',
          reasoning: '아직 안 됨',
          next_action_hint: '잠금 아이콘 클릭',
        },
      },
    });
    expect(textContent(findByTestId(tree, 'response-hint')!)).toContain(
      '잠금 아이콘 클릭',
    );
  });

  it('renders an empty placeholder when idle', () => {
    const tree = ResponsePanel({ mode: { kind: 'idle' } });
    expect(findByTestId(tree, 'response-empty')).not.toBeNull();
  });

  it('renders a loading indicator when loading', () => {
    const tree = ResponsePanel({
      mode: { kind: 'loading', pending: 'guide' },
    });
    expect(findByTestId(tree, 'response-loading')).not.toBeNull();
  });

  it('marks the panel scrollable for long messages', () => {
    const tree = ResponsePanel({
      mode: {
        kind: 'showing-guide',
        result: {
          type: 'guide',
          message: 'a'.repeat(2000),
          confidence: 'medium',
        },
      },
    });
    expect(tree.attrs?.dataset?.scrollable).toBe('true');
  });
});
