import { describe, it, expect, vi } from 'vitest';
import { ConsentBlocker } from '../../src/renderer/components/ConsentBlocker.js';
import { findByTestId, textContent } from '../../src/renderer/vnode.js';

describe('ConsentBlocker', () => {
  it('renders a settings entry button on 403 consent_required', () => {
    const onSettings = vi.fn();
    const tree = ConsentBlocker({
      mode: {
        kind: 'consent-blocked',
        reason: 'consent_required',
        lastIntent: 'guide',
      },
      onOpenSettings: onSettings,
    });
    const btn = findByTestId(tree!, 'btn-open-settings');
    expect(btn).not.toBeNull();
    btn?.attrs?.on?.click?.({});
    expect(onSettings).toHaveBeenCalledOnce();
  });

  it('shows screen-recording-permission copy on 401', () => {
    const tree = ConsentBlocker({
      mode: {
        kind: 'consent-blocked',
        reason: 'screen_recording',
        lastIntent: 'guide',
      },
      onOpenSettings: vi.fn(),
    });
    expect(textContent(tree!)).toContain('화면 기록');
  });

  it('shows anthropic-transmission copy on consent_required', () => {
    const tree = ConsentBlocker({
      mode: {
        kind: 'consent-blocked',
        reason: 'consent_required',
        lastIntent: 'verify',
      },
      onOpenSettings: vi.fn(),
    });
    expect(textContent(tree!)).toContain('동의');
  });

  it('mentions running the CLI wizard again', () => {
    const tree = ConsentBlocker({
      mode: {
        kind: 'consent-blocked',
        reason: 'consent_required',
        lastIntent: 'guide',
      },
      onOpenSettings: vi.fn(),
    });
    expect(textContent(tree!)).toMatch(/위저드|onboarding/);
  });

  it('returns null when not in consent-blocked mode', () => {
    const tree = ConsentBlocker({
      mode: { kind: 'idle' },
      onOpenSettings: vi.fn(),
    });
    expect(tree).toBeNull();
  });
});
