import { describe, it, expect, vi } from 'vitest';
import { RetryBanner } from '../../src/renderer/components/RetryBanner.js';
import { findByTestId, textContent } from '../../src/renderer/vnode.js';

describe('RetryBanner', () => {
  it('renders [🔄 재시도] button on 503 error', () => {
    const onRetry = vi.fn();
    const tree = RetryBanner({
      mode: {
        kind: 'error',
        lastIntent: 'guide',
        status: 503,
        message: 'vision_api_timeout',
      },
      onRetry,
    });
    const btn = findByTestId(tree!, 'btn-retry');
    expect(btn).not.toBeNull();
    expect(textContent(btn!)).toContain('재시도');
  });

  it('clicking [재시도] invokes onRetry', () => {
    const onRetry = vi.fn();
    const tree = RetryBanner({
      mode: {
        kind: 'error',
        lastIntent: 'guide',
        status: 503,
        message: 'timeout',
      },
      onRetry,
    });
    const btn = findByTestId(tree!, 'btn-retry');
    btn?.attrs?.on?.click?.({});
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the error status code in the message', () => {
    const tree = RetryBanner({
      mode: {
        kind: 'error',
        lastIntent: 'verify',
        status: 503,
        message: 'vision_api_timeout',
      },
      onRetry: vi.fn(),
    });
    expect(textContent(tree!)).toContain('503');
  });

  it('returns null when not in error mode', () => {
    const tree = RetryBanner({
      mode: { kind: 'idle' },
      onRetry: vi.fn(),
    });
    expect(tree).toBeNull();
  });
});
