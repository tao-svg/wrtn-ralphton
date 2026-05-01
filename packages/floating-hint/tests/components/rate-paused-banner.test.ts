import { describe, it, expect } from 'vitest';
import { RatePausedBanner } from '../../src/renderer/components/RatePausedBanner.js';
import {
  findByTestId,
  textContent,
} from '../../src/renderer/vnode.js';

describe('RatePausedBanner', () => {
  it('shows the reset countdown in mm:ss', () => {
    const now = 1_000_000;
    const resetAt = now + 90_500;
    const tree = RatePausedBanner({
      mode: {
        kind: 'rate-paused',
        resetAt,
        lastIntent: 'guide',
      },
      now,
    });
    const countdown = findByTestId(tree!, 'rate-countdown');
    expect(textContent(countdown!)).toBe('01:30');
  });

  it('clamps to 00:00 when reset_at is in the past', () => {
    const now = 5_000;
    const tree = RatePausedBanner({
      mode: { kind: 'rate-paused', resetAt: 1_000, lastIntent: 'guide' },
      now,
    });
    expect(textContent(findByTestId(tree!, 'rate-countdown')!)).toBe('00:00');
  });

  it('mentions the next-hour pause copy', () => {
    const tree = RatePausedBanner({
      mode: { kind: 'rate-paused', resetAt: 9_999_999, lastIntent: 'verify' },
      now: 0,
    });
    expect(textContent(tree!)).toContain('정지');
  });

  it('returns null when not in rate-paused mode', () => {
    const tree = RatePausedBanner({
      mode: { kind: 'idle' },
      now: 0,
    });
    expect(tree).toBeNull();
  });
});
