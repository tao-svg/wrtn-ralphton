import { describe, expect, it, expectTypeOf } from 'vitest';

import {
  CONSENT_TYPES,
  ITEM_STATUSES,
  VISION_CONFIDENCES,
  VISION_VERIFY_STATUSES,
  type ChecklistItem,
  type ConsentRecord,
  type ConsentType,
  type ItemId,
  type ItemState,
  type ItemStatus,
  type Verification,
  type VisionConfidence,
  type VisionGuideResult,
  type VisionVerifyResult,
  type VisionVerifyStatus,
} from '../src/index.js';

describe('item types', () => {
  it('exposes all SQLite-mandated statuses (PRD §8.1 item_states)', () => {
    expect(ITEM_STATUSES).toEqual([
      'pending',
      'in_progress',
      'completed',
      'skipped',
      'blocked',
    ]);
  });

  it('maps PRD §8.1 item_states columns 1:1 to ItemState', () => {
    const sample: ItemState = {
      item_id: 'install-homebrew',
      status: 'in_progress',
      current_step: 'install',
      started_at: 1_700_000_000,
      completed_at: null,
      attempt_count: 1,
    };
    expectTypeOf<ItemState['item_id']>().toEqualTypeOf<ItemId>();
    expectTypeOf<ItemState['status']>().toEqualTypeOf<ItemStatus>();
    expect(sample.attempt_count).toBe(1);
  });
});

describe('vision types', () => {
  it('lists all confidences and verify statuses (PRD §9.1.3 / 9.1.4)', () => {
    expect(VISION_CONFIDENCES).toEqual(['low', 'medium', 'high']);
    expect(VISION_VERIFY_STATUSES).toEqual(['pass', 'fail', 'unclear']);
  });

  it('binds VisionGuideResult.confidence to VisionConfidence', () => {
    const guide: VisionGuideResult = {
      type: 'guide',
      message: '잠금 아이콘을 클릭하세요',
      highlight_region: { x: 24, y: 480, width: 32, height: 32 },
      confidence: 'high',
    };
    expectTypeOf<VisionGuideResult['confidence']>().toEqualTypeOf<VisionConfidence>();
    expect(guide.type).toBe('guide');
  });

  it('binds VisionVerifyResult.status to VisionVerifyStatus', () => {
    const verify: VisionVerifyResult = {
      type: 'verify',
      status: 'pass',
      reasoning: '체크박스가 표시됨',
    };
    expectTypeOf<VisionVerifyResult['status']>().toEqualTypeOf<VisionVerifyStatus>();
    expect(verify.type).toBe('verify');
  });
});

describe('consent types', () => {
  it('lists exactly the two PRD §8.1 consent types', () => {
    expect(CONSENT_TYPES).toEqual(['screen_recording', 'anthropic_transmission']);
  });

  it('maps PRD §8.1 consents columns 1:1 to ConsentRecord', () => {
    const record: ConsentRecord = {
      consent_type: 'anthropic_transmission',
      granted: true,
      granted_at: 1_700_000_000,
      revoked_at: null,
    };
    expectTypeOf<ConsentRecord['consent_type']>().toEqualTypeOf<ConsentType>();
    expect(record.granted).toBe(true);
  });
});

describe('checklist types', () => {
  it('represents a PRD §11 yaml item with all optional sections', () => {
    const command: Verification = {
      type: 'command',
      command: 'brew --version',
      poll_interval_sec: 5,
    };
    const item: ChecklistItem = {
      id: 'install-homebrew',
      title: 'Homebrew 설치',
      estimated_minutes: 3,
      clipboard_inject: {
        command: '/bin/bash -c "$(curl -fsSL ...)"',
        ui_hint: '터미널에 붙여넣기',
      },
      verification: command,
    };
    expect(item.id).toBe('install-homebrew');
  });
});
