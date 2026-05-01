import { describe, it, expect, vi } from 'vitest';
import { ActionButtons } from '../../src/renderer/components/ActionButtons.js';
import { findByTestId, textContent } from '../../src/renderer/vnode.js';

describe('ActionButtons', () => {
  it('renders both buttons with the prescribed labels', () => {
    const tree = ActionButtons({
      mode: { kind: 'idle' },
      onGuide: () => {},
      onVerify: () => {},
    });
    const guide = findByTestId(tree, 'btn-guide');
    const verify = findByTestId(tree, 'btn-verify');
    expect(guide?.tag).toBe('button');
    expect(verify?.tag).toBe('button');
    expect(textContent(guide!)).toContain('안내 요청');
    expect(textContent(verify!)).toContain('진행 확인');
  });

  it('clicking [안내 요청] invokes onGuide', () => {
    const onGuide = vi.fn();
    const tree = ActionButtons({
      mode: { kind: 'idle' },
      onGuide,
      onVerify: () => {},
    });
    const guide = findByTestId(tree, 'btn-guide');
    expect(guide?.attrs?.on?.click).toBeTypeOf('function');
    guide?.attrs?.on?.click?.({});
    expect(onGuide).toHaveBeenCalledOnce();
  });

  it('clicking [진행 확인] invokes onVerify', () => {
    const onVerify = vi.fn();
    const tree = ActionButtons({
      mode: { kind: 'idle' },
      onGuide: () => {},
      onVerify,
    });
    const verify = findByTestId(tree, 'btn-verify');
    verify?.attrs?.on?.click?.({});
    expect(onVerify).toHaveBeenCalledOnce();
  });

  it('disables both buttons while loading', () => {
    const tree = ActionButtons({
      mode: { kind: 'loading', pending: 'guide' },
      onGuide: () => {},
      onVerify: () => {},
    });
    expect(findByTestId(tree, 'btn-guide')?.attrs?.disabled).toBe(true);
    expect(findByTestId(tree, 'btn-verify')?.attrs?.disabled).toBe(true);
  });

  it('shows a spinner inside the active button while loading', () => {
    const tree = ActionButtons({
      mode: { kind: 'loading', pending: 'verify' },
      onGuide: () => {},
      onVerify: () => {},
    });
    expect(findByTestId(tree, 'spinner-verify')).not.toBeNull();
    expect(findByTestId(tree, 'spinner-guide')).toBeNull();
  });

  it('disables both buttons when consent is blocked', () => {
    const tree = ActionButtons({
      mode: {
        kind: 'consent-blocked',
        reason: 'consent_required',
        lastIntent: 'guide',
      },
      onGuide: () => {},
      onVerify: () => {},
    });
    expect(findByTestId(tree, 'btn-guide')?.attrs?.disabled).toBe(true);
    expect(findByTestId(tree, 'btn-verify')?.attrs?.disabled).toBe(true);
  });
});
