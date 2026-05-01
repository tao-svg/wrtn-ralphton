import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ChecklistFile } from '@onboarding/shared';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import pino from 'pino';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { openDatabase, type DatabaseInstance } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { ANTHROPIC_VISION_MODEL } from '../src/p8-vision/anthropic-client.js';
import {
  bucketIdForHour,
  hourBoundaryAfter,
} from '../src/p8-vision/rate-limit.js';
import { registerApiRoutes } from '../src/routes/index.js';
import { createServer } from '../src/server.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const TEST_API_KEY = 'test-key-placeholder';

const silentLogger = pino({ level: 'silent' });

const server = setupServer();

beforeAll(() =>
  server.listen({
    onUnhandledRequest: (req, print) => {
      // supertest talks to a local Express server; only police the Anthropic API.
      const url = req.url;
      if (url.includes('127.0.0.1') || url.includes('localhost')) {
        return;
      }
      print.error();
    },
  }),
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = TEST_API_KEY;
});

const TEST_ITEM_ID = 'install-security-agent';
const TEST_STEP_ID = 'install';

const TEST_CHECKLIST: ChecklistFile = {
  version: 2,
  schema: 'ai-coaching',
  items: [
    {
      id: TEST_ITEM_ID,
      title: '사내 보안 에이전트 설치',
      estimated_minutes: 15,
      ai_coaching: {
        overall_goal: '사용자가 사내 보안 에이전트를 설치하도록 한다.',
        steps: [
          {
            id: TEST_STEP_ID,
            intent: '.pkg 파일을 더블클릭해서 설치 마법사를 진행한다.',
            success_criteria:
              '/Applications/SecurityAgent.app 디렉토리가 존재한다.',
            common_mistakes: '잠금 해제 안 한 채 클릭 시도',
          },
        ],
      },
      verification: {
        type: 'process_check',
        process_name: 'SecurityAgent',
      },
    },
  ],
};

function buildAnthropicMessageBody(text: string): Record<string, unknown> {
  return {
    id: 'msg_test_01',
    type: 'message',
    role: 'assistant',
    model: ANTHROPIC_VISION_MODEL,
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

function jsonBlock(payload: Record<string, unknown>): string {
  return `<json>${JSON.stringify(payload)}</json>`;
}

function mockMessagesOnce(
  responder: (request: Request) => Promise<Response> | Response,
): void {
  server.use(
    http.post(ANTHROPIC_MESSAGES_URL, ({ request: req }) => responder(req), {
      once: true,
    }),
  );
}

function mockGuideOnce(payload: {
  message: string;
  highlight_region:
    | { x: number; y: number; width: number; height: number }
    | null;
  confidence: 'low' | 'medium' | 'high';
}): void {
  mockMessagesOnce(() =>
    HttpResponse.json(buildAnthropicMessageBody(jsonBlock(payload))),
  );
}

function mockVerifyOnce(payload: {
  status: 'pass' | 'fail' | 'unclear';
  reasoning: string;
  next_action_hint: string;
}): void {
  mockMessagesOnce(() =>
    HttpResponse.json(buildAnthropicMessageBody(jsonBlock(payload))),
  );
}

interface AppCtx {
  app: ReturnType<typeof createServer>;
  db: DatabaseInstance;
  capture: Mock;
  capturedBuffers: Buffer[];
  setNow: (n: number) => void;
  advanceNow: (ms: number) => void;
  nowFn: () => number;
  dispose: () => void;
}

function buildApp(
  opts: {
    hashes?: string[];
    checklist?: ChecklistFile;
    grantConsents?: Array<'screen_recording' | 'anthropic_transmission'>;
    initialNow?: number;
  } = {},
): AppCtx {
  const tmpDir = mkdtempSync(join(tmpdir(), 'onboarding-vision-routes-'));
  const db = openDatabase(join(tmpDir, 'agent.db'));
  migrate(db);

  const consents = opts.grantConsents ?? [
    'screen_recording',
    'anthropic_transmission',
  ];
  const grantStmt = db.prepare(
    `INSERT INTO consents (consent_type, granted, granted_at, revoked_at)
     VALUES (@type, 1, @now, NULL)
     ON CONFLICT(consent_type) DO UPDATE SET
       granted    = 1,
       granted_at = @now,
       revoked_at = NULL`,
  );
  for (const type of consents) {
    grantStmt.run({ type, now: opts.initialNow ?? 1 });
  }

  let cur = opts.initialNow ?? 1_700_000_000_000;
  const setNow = (n: number): void => {
    cur = n;
  };
  const advanceNow = (ms: number): void => {
    cur += ms;
  };
  const nowFn = (): number => cur;

  const capturedBuffers: Buffer[] = [];
  const hashes = opts.hashes ?? ['hash-1'];
  let idx = 0;
  const capture = vi.fn().mockImplementation(async () => {
    const hash = hashes[Math.min(idx, hashes.length - 1)] ?? 'hash-fallback';
    idx += 1;
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    capturedBuffers.push(buffer);
    return { buffer, hash, width: 100, height: 80 };
  });

  const app = createServer({
    logger: silentLogger,
    registerRoutes: (a) =>
      registerApiRoutes(a, {
        checklist: opts.checklist ?? TEST_CHECKLIST,
        db,
        now: nowFn,
        visionCapture: capture,
      }),
  });

  return {
    app,
    db,
    capture,
    capturedBuffers,
    setNow,
    advanceNow,
    nowFn,
    dispose: () => {
      db.close();
      rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

describe('POST /api/vision/guide — AC-VIS-01 happy path', () => {
  let ctx: AppCtx;

  beforeEach(() => {
    ctx = buildApp();
  });

  afterEach(() => {
    ctx.dispose();
  });

  it('returns the PRD §9.1.3 envelope and writes a vision_calls row', async () => {
    mockGuideOnce({
      message: '왼쪽 상단의 잠금 해제 버튼을 누르세요',
      highlight_region: { x: 12, y: 24, width: 48, height: 40 },
      confidence: 'high',
    });

    const res = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(typeof res.body.call_id).toBe('string');
    expect(res.body.call_id).toMatch(/^vc_/);
    expect(typeof res.body.latency_ms).toBe('number');
    expect(res.body.latency_ms).toBeGreaterThanOrEqual(0);
    expect(res.body.result.type).toBe('guide');
    expect(res.body.result.message).toContain('잠금 해제');
    expect(res.body.result.confidence).toBe('high');
    expect(res.body.result.highlight_region).toEqual({
      x: 12,
      y: 24,
      width: 48,
      height: 40,
    });

    const rows = ctx.db
      .prepare(
        'SELECT call_id, item_id, step_id, request_type, image_hash, cache_hit, error FROM vision_calls',
      )
      .all() as Array<{
      call_id: string;
      item_id: string;
      step_id: string;
      request_type: string;
      image_hash: string;
      cache_hit: number;
      error: string | null;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      call_id: res.body.call_id,
      item_id: TEST_ITEM_ID,
      step_id: TEST_STEP_ID,
      request_type: 'guide',
      image_hash: 'hash-1',
      cache_hit: 0,
      error: null,
    });
  });

  it('AC-VIS-07 partial — captured buffer is zeroed after the response', async () => {
    mockGuideOnce({
      message: 'ok',
      highlight_region: null,
      confidence: 'low',
    });
    await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(ctx.capturedBuffers).toHaveLength(1);
    const buf = ctx.capturedBuffers[0]!;
    expect(buf.every((b) => b === 0)).toBe(true);

    const summaryRow = ctx.db
      .prepare('SELECT result_summary FROM vision_calls')
      .get() as { result_summary: string | null };
    expect(summaryRow.result_summary ?? '').not.toMatch(/iVBOR/i);
    expect(summaryRow.result_summary ?? '').not.toMatch(
      /[A-Za-z0-9+/]{200,}/,
    );
  });

  it('omits highlight_region when Anthropic returns null', async () => {
    mockGuideOnce({
      message: '먼저 다운로드 폴더로 이동하세요',
      highlight_region: null,
      confidence: 'medium',
    });
    const res = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(res.status).toBe(200);
    expect(res.body.result.highlight_region).toBeUndefined();
    expect(res.body.result.confidence).toBe('medium');
  });
});

describe('POST /api/vision/verify — AC-VIS-02 / AC-VIS-03', () => {
  let ctx: AppCtx;

  beforeEach(() => {
    ctx = buildApp();
  });

  afterEach(() => {
    ctx.dispose();
  });

  it('AC-VIS-02 — verify pass auto-completes the item', async () => {
    mockVerifyOnce({
      status: 'pass',
      reasoning: '/Applications/SecurityAgent.app 가 보입니다.',
      next_action_hint: '이대로 다음 단계로 진행하세요',
    });

    const res = await request(ctx.app)
      .post('/api/vision/verify')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });

    expect(res.status).toBe(200);
    expect(res.body.result.type).toBe('verify');
    expect(res.body.result.status).toBe('pass');

    const row = ctx.db
      .prepare(
        'SELECT status, completed_at FROM item_states WHERE item_id = ?',
      )
      .get(TEST_ITEM_ID) as
      | { status: string; completed_at: number | null }
      | undefined;
    expect(row?.status).toBe('completed');
    expect(typeof row?.completed_at).toBe('number');
  });

  it('AC-VIS-03 — verify fail keeps item state non-completed and surfaces hint', async () => {
    // Pre-seed the item as in_progress (someone called /api/items/:id/start).
    ctx.db
      .prepare(
        `INSERT INTO item_states (item_id, status, current_step, started_at, completed_at, attempt_count)
         VALUES (?, 'in_progress', NULL, ?, NULL, 1)`,
      )
      .run(TEST_ITEM_ID, ctx.nowFn());

    mockVerifyOnce({
      status: 'fail',
      reasoning: 'SecurityAgent 가 보이지 않습니다.',
      next_action_hint: '다시 .pkg 를 더블클릭하세요',
    });

    const res = await request(ctx.app)
      .post('/api/vision/verify')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });

    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('fail');
    expect(res.body.result.next_action_hint).toContain('.pkg');

    const row = ctx.db
      .prepare(
        'SELECT status, completed_at FROM item_states WHERE item_id = ?',
      )
      .get(TEST_ITEM_ID) as { status: string; completed_at: number | null };
    expect(row.status).toBe('in_progress');
    expect(row.completed_at).toBeNull();
  });

  it('verify unclear — same shape, no completion', async () => {
    mockVerifyOnce({
      status: 'unclear',
      reasoning: '화면이 너무 작아 판단 불가',
      next_action_hint: '창을 최대화하고 다시 시도하세요',
    });

    const res = await request(ctx.app)
      .post('/api/vision/verify')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('unclear');

    const row = ctx.db
      .prepare(
        'SELECT status FROM item_states WHERE item_id = ?',
      )
      .get(TEST_ITEM_ID) as { status: string } | undefined;
    expect(row?.status ?? null).not.toBe('completed');
  });
});

describe('POST /api/vision/guide — AC-VIS-04 cache hit', () => {
  let ctx: AppCtx;

  beforeEach(() => {
    ctx = buildApp({ hashes: ['same-hash', 'same-hash'] });
  });

  afterEach(() => {
    ctx.dispose();
  });

  it('second call within 30s returns cached=true and does not hit Anthropic', async () => {
    mockGuideOnce({
      message: '클릭하세요',
      highlight_region: null,
      confidence: 'high',
    });

    const first = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);

    // Advance past the 1s debounce window but stay inside the 30s cache TTL.
    ctx.advanceNow(1500);

    // No mock registered for the second call — msw onUnhandledRequest:'error'
    // would fail this test if the orchestrator hit the network.
    const second = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });

    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(second.body.latency_ms).toBeLessThan(100);
    expect(second.body.result).toEqual(first.body.result);

    // vision_calls only logs the network-going call, not the cache hit.
    const count = ctx.db
      .prepare('SELECT COUNT(*) as c FROM vision_calls')
      .get() as { c: number };
    expect(count.c).toBe(1);
  });
});

describe('POST /api/vision/verify — cache + error paths', () => {
  let ctx: AppCtx;

  beforeEach(() => {
    ctx = buildApp({ hashes: ['verify-hash', 'verify-hash'] });
  });

  afterEach(() => {
    ctx.dispose();
  });

  it('second verify call within 30s returns cached=true without an Anthropic round-trip', async () => {
    mockVerifyOnce({
      status: 'fail',
      reasoning: '아직 설치되지 않았습니다.',
      next_action_hint: '.pkg 를 더블클릭하세요',
    });

    const first = await request(ctx.app)
      .post('/api/vision/verify')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);

    ctx.advanceNow(1500);

    const second = await request(ctx.app)
      .post('/api/vision/verify')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(second.body.result).toEqual(first.body.result);
  });

  it('Anthropic error on verify path → 503 vision_api_error and audit row', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        { type: 'error', error: { type: 'api_error' } },
        { status: 500 },
      ),
    );
    const res = await request(ctx.app)
      .post('/api/vision/verify')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'vision_api_error' });

    const row = ctx.db
      .prepare(
        'SELECT request_type, error FROM vision_calls',
      )
      .get() as { request_type: string; error: string | null } | undefined;
    expect(row?.request_type).toBe('verify');
    expect(row?.error).toBe('anthropic_server_error');
  });
});

describe('POST /api/vision/guide — AC-VIS-05 paused', () => {
  let ctx: AppCtx;
  const baseTime = Math.floor(1_700_000_000_000 / 3_600_000) * 3_600_000;

  beforeEach(() => {
    ctx = buildApp({ initialNow: baseTime });
    // Pre-seed the bucket as fully exhausted.
    const bucketId = String(bucketIdForHour(baseTime));
    ctx.db
      .prepare(
        `INSERT INTO rate_limit_buckets (bucket_id, call_count, alert_sent, paused, reset_at)
         VALUES (?, 200, 1, 1, ?)`,
      )
      .run(bucketId, hourBoundaryAfter(baseTime));
  });

  afterEach(() => {
    ctx.dispose();
  });

  it('returns 429 with state=paused and reset_at', async () => {
    const res = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: 'rate_limit_exceeded',
      state: 'paused',
      reset_at: hourBoundaryAfter(baseTime),
    });
    // No anthropic call, no capture either.
    expect(ctx.capture).not.toHaveBeenCalled();
  });

  it('verify path is paused too', async () => {
    const res = await request(ctx.app)
      .post('/api/vision/verify')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(res.status).toBe(429);
    expect(res.body.state).toBe('paused');
  });
});

describe('POST /api/vision/guide — AC-VIS-06 timeout / API error', () => {
  let ctx: AppCtx;

  beforeEach(() => {
    ctx = buildApp();
  });

  afterEach(() => {
    ctx.dispose();
  });

  it('Anthropic 504 → 503 vision_api_timeout', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        { type: 'error', error: { type: 'timeout' } },
        { status: 504 },
      ),
    );
    const res = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'vision_api_timeout' });

    // Failure still goes into vision_calls so /admin can see it.
    const row = ctx.db
      .prepare(
        'SELECT request_type, error, cache_hit FROM vision_calls',
      )
      .get() as
      | { request_type: string; error: string | null; cache_hit: number }
      | undefined;
    expect(row).toBeDefined();
    expect(row?.error).toBe('anthropic_timeout_error');
    expect(row?.cache_hit).toBe(0);
  });

  it('Anthropic 500 → 503 vision_api_error', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        { type: 'error', error: { type: 'api_error' } },
        { status: 500 },
      ),
    );
    const res = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'vision_api_error' });
  });

  it('Anthropic 401 → 503 vision_api_error', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        { type: 'error', error: { type: 'authentication_error' } },
        { status: 401 },
      ),
    );
    const res = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'vision_api_error' });
  });

  it('malformed model output → 503 vision_response_invalid', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        buildAnthropicMessageBody('I cannot help with that.'),
      ),
    );
    const res = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'vision_response_invalid' });
  });
});

describe('POST /api/vision/guide — debounce 429 throttled', () => {
  let ctx: AppCtx;

  beforeEach(() => {
    ctx = buildApp({ hashes: ['hash-a', 'hash-b'] });
  });

  afterEach(() => {
    ctx.dispose();
  });

  it('two calls within 1s for the same step return throttled', async () => {
    mockGuideOnce({
      message: 'first',
      highlight_region: null,
      confidence: 'high',
    });

    const first = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(first.status).toBe(200);

    // Stay under the 1s debounce window.
    ctx.advanceNow(500);

    const second = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
    expect(second.status).toBe(429);
    expect(second.body).toEqual({
      error: 'rate_limit_exceeded',
      state: 'throttled',
    });
  });
});

describe('consent gating', () => {
  it('missing screen_recording consent → 401 screen_recording_permission_required', async () => {
    const ctx = buildApp({ grantConsents: ['anthropic_transmission'] });
    try {
      const res = await request(ctx.app)
        .post('/api/vision/guide')
        .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: 'screen_recording_permission_required',
      });
    } finally {
      ctx.dispose();
    }
  });

  it('missing anthropic_transmission consent → 403 consent_required', async () => {
    const ctx = buildApp({ grantConsents: ['screen_recording'] });
    try {
      const res = await request(ctx.app)
        .post('/api/vision/guide')
        .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('consent_required');
      expect(res.body.missing).toContain('anthropic_transmission');
    } finally {
      ctx.dispose();
    }
  });

  it('verify path also gates on both consents', async () => {
    const ctx = buildApp({ grantConsents: [] });
    try {
      const res = await request(ctx.app)
        .post('/api/vision/verify')
        .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });
      // SR missing wins per consents/middleware.ts contract.
      expect(res.status).toBe(401);
    } finally {
      ctx.dispose();
    }
  });
});

describe('item / step / body validation', () => {
  let ctx: AppCtx;

  beforeEach(() => {
    ctx = buildApp();
  });

  afterEach(() => {
    ctx.dispose();
  });

  it('400 when item_id is missing from the body', async () => {
    const res = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ step_id: TEST_STEP_ID });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('400 on extra unknown field (strict zod object)', async () => {
    const res = await request(ctx.app)
      .post('/api/vision/guide')
      .send({
        item_id: TEST_ITEM_ID,
        step_id: TEST_STEP_ID,
        extra: 'nope',
      });
    expect(res.status).toBe(400);
  });

  it('404 when item_id is not in the checklist', async () => {
    const res = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: 'no-such-item', step_id: TEST_STEP_ID });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'item_not_found' });
    expect(ctx.capture).not.toHaveBeenCalled();
  });

  it('404 when step_id is unknown for the item', async () => {
    const res = await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: 'no-such-step' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'step_not_found' });
    expect(ctx.capture).not.toHaveBeenCalled();
  });

  it('verify route — 404 when item missing', async () => {
    const res = await request(ctx.app)
      .post('/api/vision/verify')
      .send({ item_id: 'no-such-item', step_id: TEST_STEP_ID });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'item_not_found' });
  });
});

describe('rate-limit accounting from /api/vision/guide hits', () => {
  let ctx: AppCtx;

  beforeEach(() => {
    ctx = buildApp();
  });

  afterEach(() => {
    ctx.dispose();
  });

  it('successful guide call increments the hour bucket', async () => {
    mockGuideOnce({
      message: 'ok',
      highlight_region: null,
      confidence: 'low',
    });
    await request(ctx.app)
      .post('/api/vision/guide')
      .send({ item_id: TEST_ITEM_ID, step_id: TEST_STEP_ID });

    const status = await request(ctx.app).get('/api/vision/rate-limit');
    expect(status.status).toBe(200);
    expect(status.body.current_hour_calls).toBe(1);
    expect(status.body.state).toBe('normal');
  });
});
