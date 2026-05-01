import { describe, expect, it } from 'vitest';

import {
  AiCoachingSchema,
  ChecklistFileSchema,
  ChecklistInputSchema,
  ChecklistItemSchema,
  ChecklistStepSchema,
  ClipboardInjectSchema,
  CommandVerificationSchema,
  ProcessCheckVerificationSchema,
  TemplateSchema,
  VerificationSchema,
} from '../src/schemas/checklist.js';

function roundTrip<T>(schema: { parse: (v: unknown) => T }, value: unknown): T {
  const parsed = schema.parse(value);
  const reparsed = schema.parse(JSON.parse(JSON.stringify(parsed)));
  expect(reparsed).toEqual(parsed);
  return parsed;
}

describe('ChecklistInputSchema (PRD §11 inputs[])', () => {
  it('round-trips a required input', () => {
    const v = { key: 'git_email', label: 'Git 이메일', required: true };
    expect(roundTrip(ChecklistInputSchema, v)).toEqual(v);
  });

  it('rejects empty key', () => {
    expect(() =>
      ChecklistInputSchema.parse({ key: '', label: 'x', required: true }),
    ).toThrow();
  });
});

describe('ClipboardInjectSchema (PRD §11 clipboard_inject)', () => {
  it('round-trips with ui_hint', () => {
    const v = { command: 'open https://example.com', ui_hint: '브라우저가 열립니다' };
    expect(roundTrip(ClipboardInjectSchema, v)).toEqual(v);
  });

  it('round-trips without ui_hint', () => {
    const v = { command: 'echo hi' };
    expect(roundTrip(ClipboardInjectSchema, v)).toEqual(v);
  });

  it('rejects empty command', () => {
    expect(() => ClipboardInjectSchema.parse({ command: '' })).toThrow();
  });
});

describe('VerificationSchema (PRD §11 verification)', () => {
  it('round-trips command verification', () => {
    const v = { type: 'command', command: 'brew --version', poll_interval_sec: 5 };
    expect(roundTrip(VerificationSchema, v)).toEqual(v);
    expect(roundTrip(CommandVerificationSchema, v)).toEqual(v);
  });

  it('round-trips command verification with expect_contains', () => {
    const v = {
      type: 'command',
      command: 'git config --global user.email',
      expect_contains: 'user@example.com',
    };
    expect(roundTrip(VerificationSchema, v)).toEqual(v);
  });

  it('round-trips process_check verification', () => {
    const v = {
      type: 'process_check',
      process_name: 'SecurityAgent',
      poll_interval_sec: 5,
    };
    expect(roundTrip(VerificationSchema, v)).toEqual(v);
    expect(roundTrip(ProcessCheckVerificationSchema, v)).toEqual(v);
  });

  it('rejects an unknown verification type', () => {
    expect(() =>
      VerificationSchema.parse({ type: 'magic', command: 'x' }),
    ).toThrow();
  });

  it('rejects zero or negative poll_interval_sec', () => {
    expect(() =>
      VerificationSchema.parse({
        type: 'command',
        command: 'x',
        poll_interval_sec: 0,
      }),
    ).toThrow();
    expect(() =>
      VerificationSchema.parse({
        type: 'command',
        command: 'x',
        poll_interval_sec: -1,
      }),
    ).toThrow();
  });
});

describe('ChecklistStepSchema + AiCoachingSchema (PRD §11 ai_coaching)', () => {
  it('round-trips a step with all optional fields', () => {
    const v = {
      id: 'grant_permission',
      intent: '권한 부여',
      success_criteria: 'pgrep SecurityAgent → PID 반환',
      system_panel_url:
        'x-apple.systempreferences:com.apple.preference.security',
      common_mistakes: '잠금 해제 안 한 채 클릭 시도',
    };
    expect(roundTrip(ChecklistStepSchema, v)).toEqual(v);
  });

  it('round-trips ai_coaching with multiple steps', () => {
    const v = {
      overall_goal: '보안 에이전트 설치',
      steps: [
        { id: 'download', intent: 'd', success_criteria: 'c1' },
        {
          id: 'install',
          intent: 'i',
          success_criteria: 'c2',
          system_panel_url: 'x-apple.systempreferences:com.apple.preference',
        },
      ],
    };
    expect(roundTrip(AiCoachingSchema, v)).toEqual(v);
  });

  it('rejects ai_coaching with empty steps', () => {
    expect(() =>
      AiCoachingSchema.parse({ overall_goal: 'g', steps: [] }),
    ).toThrow();
  });
});

describe('TemplateSchema (PRD §11 template)', () => {
  it('round-trips a Gmail signature template', () => {
    const v = {
      content: '{{user_profile.name}}\n{{inputs.job_title}}',
      paste_target: 'Gmail 서명 입력란',
    };
    expect(roundTrip(TemplateSchema, v)).toEqual(v);
  });

  it('rejects empty content or paste_target', () => {
    expect(() =>
      TemplateSchema.parse({ content: '', paste_target: 'x' }),
    ).toThrow();
    expect(() =>
      TemplateSchema.parse({ content: 'x', paste_target: '' }),
    ).toThrow();
  });
});

describe('ChecklistItemSchema (PRD §11 items[])', () => {
  it('round-trips a minimal item', () => {
    const v = {
      id: 'install-homebrew',
      title: 'Homebrew 설치',
      estimated_minutes: 3,
    };
    expect(roundTrip(ChecklistItemSchema, v)).toEqual(v);
  });

  it('round-trips a P2+P4 item (homebrew)', () => {
    const v = {
      id: 'install-homebrew',
      title: 'Homebrew 설치',
      estimated_minutes: 3,
      clipboard_inject: {
        command: '/bin/bash -c "$(curl -fsSL ...)"',
        ui_hint: '터미널에 ⌘V',
      },
      verification: {
        type: 'command',
        command: 'brew --version',
        poll_interval_sec: 5,
      },
    };
    expect(roundTrip(ChecklistItemSchema, v)).toEqual(v);
  });

  it('round-trips a P5+/P8/P4 item (security agent)', () => {
    const v = {
      id: 'install-security-agent',
      title: '사내 보안 에이전트 설치',
      estimated_minutes: 15,
      ai_coaching: {
        overall_goal: '에이전트 설치 및 권한 부여',
        steps: [
          { id: 'download', intent: 'd', success_criteria: 'pkg in ~/Downloads' },
          {
            id: 'grant_permission',
            intent: 'g',
            success_criteria: 'pid returned',
            system_panel_url:
              'x-apple.systempreferences:com.apple.preference.security',
          },
        ],
      },
      verification: { type: 'process_check', process_name: 'SecurityAgent' },
    };
    expect(roundTrip(ChecklistItemSchema, v)).toEqual(v);
  });

  it('rejects estimated_minutes <= 0', () => {
    expect(() =>
      ChecklistItemSchema.parse({ id: 'x', title: 'y', estimated_minutes: 0 }),
    ).toThrow();
    expect(() =>
      ChecklistItemSchema.parse({ id: 'x', title: 'y', estimated_minutes: -1 }),
    ).toThrow();
  });

  it('rejects extra fields (strict)', () => {
    expect(() =>
      ChecklistItemSchema.parse({
        id: 'x',
        title: 'y',
        estimated_minutes: 1,
        unknown_field: 'oops',
      }),
    ).toThrow();
  });
});

describe('ChecklistFileSchema (top-level yaml)', () => {
  it('round-trips a v2 ai-coaching file', () => {
    const v = {
      version: 2,
      schema: 'ai-coaching',
      items: [{ id: 'a', title: 'A', estimated_minutes: 1 }],
    };
    expect(roundTrip(ChecklistFileSchema, v)).toEqual(v);
  });

  it('rejects empty items', () => {
    expect(() =>
      ChecklistFileSchema.parse({ version: 2, schema: 'ai-coaching', items: [] }),
    ).toThrow();
  });
});
