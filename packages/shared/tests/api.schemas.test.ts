import { describe, expect, it } from 'vitest';

import {
  ClipboardRequestSchema,
  ClipboardResponseSchema,
  ConsentRecordSchema,
  GetChecklistResponseSchema,
  GetConsentsResponseSchema,
  HighlightRegionSchema,
  ItemStateSchema,
  PostConsentRequestSchema,
  PostConsentResponseSchema,
  RateLimitResponseSchema,
  StartItemParamsSchema,
  StartItemResponseSchema,
  SystemPanelLaunchRequestSchema,
  SystemPanelLaunchResponseSchema,
  VerifyRunRequestSchema,
  VerifyRunResponseSchema,
  VisionGuideErrorResponseSchema,
  VisionGuideRequestSchema,
  VisionGuideResponseSchema,
  VisionGuideResultSchema,
  VisionVerifyRequestSchema,
  VisionVerifyResponseSchema,
  VisionVerifyResultSchema,
} from '../src/schemas/api.js';

function roundTrip<T>(schema: { parse: (v: unknown) => T }, value: unknown): T {
  const parsed = schema.parse(value);
  const reparsed = schema.parse(JSON.parse(JSON.stringify(parsed)));
  expect(reparsed).toEqual(parsed);
  return parsed;
}

describe('HighlightRegionSchema (spec AC: 4 fields, reject negative/zero)', () => {
  it('accepts strictly positive {x,y,width,height} round-trip', () => {
    const region = { x: 24, y: 480, width: 32, height: 32 };
    const parsed = roundTrip(HighlightRegionSchema, region);
    expect(parsed).toEqual(region);
  });

  it.each([
    { x: 0, y: 1, width: 1, height: 1 },
    { x: 1, y: 0, width: 1, height: 1 },
    { x: 1, y: 1, width: 0, height: 1 },
    { x: 1, y: 1, width: 1, height: 0 },
  ])('rejects zero in any dimension (%o)', (region) => {
    expect(() => HighlightRegionSchema.parse(region)).toThrow();
  });

  it.each([
    { x: -1, y: 1, width: 1, height: 1 },
    { x: 1, y: -1, width: 1, height: 1 },
    { x: 1, y: 1, width: -1, height: 1 },
    { x: 1, y: 1, width: 1, height: -1 },
  ])('rejects negative values in any dimension (%o)', (region) => {
    expect(() => HighlightRegionSchema.parse(region)).toThrow();
  });

  it('rejects extra fields', () => {
    expect(() =>
      HighlightRegionSchema.parse({ x: 1, y: 1, width: 1, height: 1, extra: 0 }),
    ).toThrow();
  });

  it('rejects non-number fields', () => {
    expect(() =>
      HighlightRegionSchema.parse({ x: '1', y: 1, width: 1, height: 1 }),
    ).toThrow();
  });
});

describe('ItemStateSchema (PRD §8.1 item_states 1:1)', () => {
  it('round-trips a fully populated record', () => {
    const v = {
      item_id: 'install-homebrew',
      status: 'in_progress',
      current_step: 'install',
      started_at: 1_700_000_000,
      completed_at: null,
      attempt_count: 2,
    };
    expect(roundTrip(ItemStateSchema, v)).toEqual(v);
  });

  it('accepts all PRD-defined statuses', () => {
    for (const status of ['pending', 'in_progress', 'completed', 'skipped', 'blocked']) {
      expect(() =>
        ItemStateSchema.parse({
          item_id: 'x',
          status,
          current_step: null,
          started_at: null,
          completed_at: null,
          attempt_count: 0,
        }),
      ).not.toThrow();
    }
  });

  it('rejects an unknown status', () => {
    expect(() =>
      ItemStateSchema.parse({
        item_id: 'x',
        status: 'mystery',
        current_step: null,
        started_at: null,
        completed_at: null,
        attempt_count: 0,
      }),
    ).toThrow();
  });

  it('rejects negative attempt_count', () => {
    expect(() =>
      ItemStateSchema.parse({
        item_id: 'x',
        status: 'pending',
        current_step: null,
        started_at: null,
        completed_at: null,
        attempt_count: -1,
      }),
    ).toThrow();
  });
});

describe('VisionGuideResultSchema (PRD §9.1.3 result)', () => {
  it('round-trips a result with highlight_region', () => {
    const v = {
      type: 'guide',
      message: '화면 좌측 잠금 아이콘을 클릭하세요',
      highlight_region: { x: 24, y: 480, width: 32, height: 32 },
      confidence: 'high',
    };
    expect(roundTrip(VisionGuideResultSchema, v)).toEqual(v);
  });

  it('round-trips a result without highlight_region', () => {
    const v = { type: 'guide', message: 'hi', confidence: 'low' };
    expect(roundTrip(VisionGuideResultSchema, v)).toEqual(v);
  });

  it('rejects mismatched literal type', () => {
    expect(() =>
      VisionGuideResultSchema.parse({
        type: 'verify',
        message: 'x',
        confidence: 'low',
      }),
    ).toThrow();
  });
});

describe('VisionVerifyResultSchema (PRD §9.1.4 result)', () => {
  it.each(['pass', 'fail', 'unclear'] as const)('accepts status=%s', (status) => {
    const v = { type: 'verify', status, reasoning: 'because' };
    expect(roundTrip(VisionVerifyResultSchema, v)).toEqual(v);
  });

  it('round-trips with optional next_action_hint', () => {
    const v = {
      type: 'verify',
      status: 'fail',
      reasoning: 'r',
      next_action_hint: 'try again',
    };
    expect(roundTrip(VisionVerifyResultSchema, v)).toEqual(v);
  });

  it('rejects unknown status', () => {
    expect(() =>
      VisionVerifyResultSchema.parse({
        type: 'verify',
        status: 'maybe',
        reasoning: 'x',
      }),
    ).toThrow();
  });
});

describe('GetChecklistResponseSchema (PRD §9.1.1)', () => {
  it('round-trips an items array', () => {
    const v = {
      items: [
        {
          item_id: 'a',
          status: 'pending',
          current_step: null,
          started_at: null,
          completed_at: null,
          attempt_count: 0,
        },
      ],
    };
    expect(roundTrip(GetChecklistResponseSchema, v)).toEqual(v);
  });
});

describe('Start item endpoint (PRD §9.1.2)', () => {
  it('round-trips params and ok response', () => {
    expect(roundTrip(StartItemParamsSchema, { itemId: 'install-homebrew' })).toEqual({
      itemId: 'install-homebrew',
    });
    expect(roundTrip(StartItemResponseSchema, { ok: true })).toEqual({ ok: true });
  });

  it('rejects ok=false', () => {
    expect(() => StartItemResponseSchema.parse({ ok: false })).toThrow();
  });
});

describe('Vision guide endpoint (PRD §9.1.3)', () => {
  it('round-trips request', () => {
    const req = { item_id: 'install-homebrew', step_id: 'download' };
    expect(roundTrip(VisionGuideRequestSchema, req)).toEqual(req);
  });

  it('round-trips a 200 response with cached=false', () => {
    const v = {
      call_id: 'vc_abc',
      cached: false,
      latency_ms: 2840,
      result: {
        type: 'guide',
        message: '화면 좌측 잠금 아이콘을 클릭하세요',
        highlight_region: { x: 24, y: 480, width: 32, height: 32 },
        confidence: 'high',
      },
    };
    expect(roundTrip(VisionGuideResponseSchema, v)).toEqual(v);
  });

  it('rejects negative latency_ms', () => {
    expect(() =>
      VisionGuideResponseSchema.parse({
        call_id: 'x',
        cached: false,
        latency_ms: -1,
        result: { type: 'guide', message: 'x', confidence: 'low' },
      }),
    ).toThrow();
  });

  describe('error responses', () => {
    it('round-trips 401 screen_recording_permission_required', () => {
      const v = { error: 'screen_recording_permission_required' };
      expect(roundTrip(VisionGuideErrorResponseSchema, v)).toEqual(v);
    });

    it('round-trips 403 consent_required', () => {
      const v = { error: 'consent_required' };
      expect(roundTrip(VisionGuideErrorResponseSchema, v)).toEqual(v);
    });

    it('round-trips 429 rate_limit_exceeded', () => {
      const v = {
        error: 'rate_limit_exceeded',
        state: 'paused',
        reset_at: 1_700_000_000,
      };
      expect(roundTrip(VisionGuideErrorResponseSchema, v)).toEqual(v);
    });

    it('round-trips 503 vision_api_timeout', () => {
      const v = { error: 'vision_api_timeout' };
      expect(roundTrip(VisionGuideErrorResponseSchema, v)).toEqual(v);
    });

    it('rejects unknown error code', () => {
      expect(() =>
        VisionGuideErrorResponseSchema.parse({ error: 'unknown_thing' }),
      ).toThrow();
    });
  });
});

describe('Vision verify endpoint (PRD §9.1.4)', () => {
  it('round-trips request and 200 response', () => {
    const req = { item_id: 'a', step_id: 'b' };
    expect(roundTrip(VisionVerifyRequestSchema, req)).toEqual(req);

    const res = {
      call_id: 'vc_x',
      result: { type: 'verify', status: 'pass', reasoning: 'ok' },
    };
    expect(roundTrip(VisionVerifyResponseSchema, res)).toEqual(res);
  });
});

describe('Rate limit endpoint (PRD §9.1.5)', () => {
  it('round-trips a normal-state response', () => {
    const v = { current_hour_calls: 47, state: 'normal', reset_at: 1_700_003_600 };
    expect(roundTrip(RateLimitResponseSchema, v)).toEqual(v);
  });

  it.each(['normal', 'alert', 'paused'] as const)('accepts state=%s', (state) => {
    const v = { current_hour_calls: 1, state, reset_at: 0 };
    expect(() => RateLimitResponseSchema.parse(v)).not.toThrow();
  });

  it('rejects unknown state', () => {
    expect(() =>
      RateLimitResponseSchema.parse({
        current_hour_calls: 1,
        state: 'cool',
        reset_at: 0,
      }),
    ).toThrow();
  });
});

describe('Consent endpoints (PRD §9.1.6)', () => {
  it('round-trips POST /api/consents request and response', () => {
    const req = { consent_type: 'anthropic_transmission', granted: true };
    expect(roundTrip(PostConsentRequestSchema, req)).toEqual(req);
    expect(roundTrip(PostConsentResponseSchema, { ok: true })).toEqual({ ok: true });
  });

  it('rejects unknown consent_type', () => {
    expect(() =>
      PostConsentRequestSchema.parse({ consent_type: 'mystery', granted: true }),
    ).toThrow();
  });

  it('round-trips GET /api/consents response', () => {
    const v = {
      screen_recording: {
        consent_type: 'screen_recording',
        granted: true,
        granted_at: 1,
        revoked_at: null,
      },
      anthropic_transmission: {
        consent_type: 'anthropic_transmission',
        granted: false,
        granted_at: null,
        revoked_at: 2,
      },
    };
    expect(roundTrip(GetConsentsResponseSchema, v)).toEqual(v);
  });

  it('round-trips a single ConsentRecord', () => {
    const v = {
      consent_type: 'screen_recording',
      granted: true,
      granted_at: 1,
      revoked_at: null,
    };
    expect(roundTrip(ConsentRecordSchema, v)).toEqual(v);
  });
});

describe('Clipboard endpoint (PRD §9.1.7)', () => {
  it('round-trips request and response', () => {
    const req = { command: 'echo hi' };
    expect(roundTrip(ClipboardRequestSchema, req)).toEqual(req);
    expect(roundTrip(ClipboardResponseSchema, { ok: true })).toEqual({ ok: true });
  });

  it('rejects empty command', () => {
    expect(() => ClipboardRequestSchema.parse({ command: '' })).toThrow();
  });
});

describe('Verify run endpoint (PRD §9.1.8)', () => {
  it('round-trips command verification request', () => {
    const v = {
      item_id: 'install-homebrew',
      verification: {
        type: 'command',
        command: 'brew --version',
        poll_interval_sec: 5,
      },
    };
    expect(roundTrip(VerifyRunRequestSchema, v)).toEqual(v);
  });

  it('round-trips process_check verification request', () => {
    const v = {
      item_id: 'install-security-agent',
      verification: { type: 'process_check', process_name: 'SecurityAgent' },
    };
    expect(roundTrip(VerifyRunRequestSchema, v)).toEqual(v);
  });

  it.each(['pass', 'fail'] as const)('round-trips response status=%s', (status) => {
    const res = { status, details: 'exit code 0' };
    expect(roundTrip(VerifyRunResponseSchema, res)).toEqual(res);
  });

  it('rejects an "unclear" status (only used by Vision verify)', () => {
    expect(() =>
      VerifyRunResponseSchema.parse({ status: 'unclear', details: '' }),
    ).toThrow();
  });
});

describe('SystemPanelLaunchRequestSchema (P5+ system-panel)', () => {
  it('round-trips a request with only url', () => {
    const v = {
      url: 'x-apple.systempreferences:com.apple.preference.security',
    };
    expect(roundTrip(SystemPanelLaunchRequestSchema, v)).toEqual(v);
  });

  it('round-trips a request with only item_id+step_id (yaml lookup)', () => {
    const v = { item_id: 'install-security-agent', step_id: 'grant_permission' };
    expect(roundTrip(SystemPanelLaunchRequestSchema, v)).toEqual(v);
  });

  it('round-trips a request with all three fields (url takes precedence at handler)', () => {
    const v = {
      url: 'https://override.example',
      item_id: 'install-security-agent',
      step_id: 'grant_permission',
    };
    expect(roundTrip(SystemPanelLaunchRequestSchema, v)).toEqual(v);
  });

  it('rejects an empty body (refine: at least one form must be provided)', () => {
    expect(() => SystemPanelLaunchRequestSchema.parse({})).toThrow();
  });

  it('rejects body with only item_id (refine: step_id is also required)', () => {
    expect(() =>
      SystemPanelLaunchRequestSchema.parse({ item_id: 'foo' }),
    ).toThrow();
  });

  it('rejects body with only step_id (refine: item_id is also required)', () => {
    expect(() =>
      SystemPanelLaunchRequestSchema.parse({ step_id: 'foo' }),
    ).toThrow();
  });

  it('rejects an empty url string (z.string().min(1))', () => {
    expect(() =>
      SystemPanelLaunchRequestSchema.parse({ url: '' }),
    ).toThrow();
  });

  it('rejects extra unknown keys (strict)', () => {
    expect(() =>
      SystemPanelLaunchRequestSchema.parse({
        url: 'https://example.com',
        evil: true,
      }),
    ).toThrow();
  });

  it('rejects non-string url', () => {
    expect(() =>
      SystemPanelLaunchRequestSchema.parse({ url: 42 }),
    ).toThrow();
  });

  it('round-trips response { ok: true, url }', () => {
    const v = { ok: true as const, url: 'https://example.com' };
    expect(roundTrip(SystemPanelLaunchResponseSchema, v)).toEqual(v);
  });

  it('rejects response with ok: false', () => {
    expect(() =>
      SystemPanelLaunchResponseSchema.parse({ ok: false, url: 'https://x' }),
    ).toThrow();
  });
});
