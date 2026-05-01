import { describe, it, expect, vi } from 'vitest';
import { HintWindow } from '../../src/renderer/components/HintWindow.js';
import type { AppState } from '../../src/renderer/state/machine.js';
import { findByTestId, textContent } from '../../src/renderer/vnode.js';

const baseState: AppState = {
  mode: { kind: 'idle' },
  context: {
    itemId: 'install',
    stepId: 's0',
    stepIndex: 0,
    totalSteps: 2,
  },
  stepIds: ['s0', 's1'],
};

const callbacks = {
  onGuide: vi.fn(),
  onVerify: vi.fn(),
  onRetry: vi.fn(),
  onOpenSettings: vi.fn(),
  now: 0,
};

describe('HintWindow', () => {
  it('renders progress badge + buttons + response panel in idle state', () => {
    const tree = HintWindow({ state: baseState, ...callbacks });
    expect(findByTestId(tree, 'progress-badge')).not.toBeNull();
    expect(findByTestId(tree, 'btn-guide')).not.toBeNull();
    expect(findByTestId(tree, 'btn-verify')).not.toBeNull();
    expect(findByTestId(tree, 'response-panel')).not.toBeNull();
  });

  it('shows progress "단계 1/2"', () => {
    const tree = HintWindow({ state: baseState, ...callbacks });
    expect(textContent(findByTestId(tree, 'progress-badge')!)).toBe('단계 1/2');
  });

  it('renders RetryBanner when in error mode', () => {
    const tree = HintWindow({
      state: {
        ...baseState,
        mode: {
          kind: 'error',
          lastIntent: 'guide',
          status: 503,
          message: 'vision_api_timeout',
        },
      },
      ...callbacks,
    });
    expect(findByTestId(tree, 'retry-banner')).not.toBeNull();
  });

  it('renders RatePausedBanner when in rate-paused mode', () => {
    const tree = HintWindow({
      state: {
        ...baseState,
        mode: { kind: 'rate-paused', resetAt: 1_000, lastIntent: 'guide' },
      },
      ...callbacks,
      now: 0,
    });
    expect(findByTestId(tree, 'rate-paused-banner')).not.toBeNull();
  });

  it('renders ConsentBlocker when in consent-blocked mode', () => {
    const tree = HintWindow({
      state: {
        ...baseState,
        mode: {
          kind: 'consent-blocked',
          reason: 'consent_required',
          lastIntent: 'guide',
        },
      },
      ...callbacks,
    });
    expect(findByTestId(tree, 'consent-blocker')).not.toBeNull();
  });

  it('does not render banners when idle', () => {
    const tree = HintWindow({ state: baseState, ...callbacks });
    expect(findByTestId(tree, 'retry-banner')).toBeNull();
    expect(findByTestId(tree, 'rate-paused-banner')).toBeNull();
    expect(findByTestId(tree, 'consent-blocker')).toBeNull();
  });

  it('renders the response panel above other regions', () => {
    const tree = HintWindow({
      state: {
        ...baseState,
        mode: {
          kind: 'showing-guide',
          result: { type: 'guide', message: '클릭', confidence: 'high' },
        },
      },
      ...callbacks,
    });
    expect(textContent(findByTestId(tree, 'response-message')!)).toBe('클릭');
  });
});
