import { describe, it, expect } from 'vitest';
import { ProgressBadge } from '../../src/renderer/components/ProgressBadge.js';
import { findByTestId, textContent } from '../../src/renderer/vnode.js';

describe('ProgressBadge', () => {
  it('renders "단계 N/M" when totalSteps > 0', () => {
    const tree = ProgressBadge({ stepIndex: 1, totalSteps: 3 });
    const node = findByTestId(tree, 'progress-badge');
    expect(node).not.toBeNull();
    expect(textContent(node!)).toBe('단계 2/3');
  });

  it('shows 1-based step index', () => {
    const tree = ProgressBadge({ stepIndex: 0, totalSteps: 3 });
    expect(textContent(findByTestId(tree, 'progress-badge')!)).toBe('단계 1/3');
  });

  it('hides itself when totalSteps is 0', () => {
    const tree = ProgressBadge({ stepIndex: 0, totalSteps: 0 });
    expect(tree.attrs?.hidden).toBe(true);
  });
});
