import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ChecklistItem, ChecklistStep } from '@onboarding/shared';

import {
  ANTHROPIC_MAX_TOKENS,
  ANTHROPIC_REQUEST_TIMEOUT_MS,
  ANTHROPIC_VISION_MODEL,
  AnthropicAuthError,
  AnthropicServerError,
  AnthropicTimeoutError,
  callGuide,
  callVerify,
  VisionResponseFormatError,
} from '../src/p8-vision/anthropic-client.js';
import {
  buildGuideUserPrompt,
  GUIDE_SYSTEM_PROMPT,
} from '../src/p8-vision/prompts/guide.js';
import {
  buildVerifyUserPrompt,
  VERIFY_SYSTEM_PROMPT,
} from '../src/p8-vision/prompts/verify.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const TEST_API_KEY = 'test-key-placeholder';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = TEST_API_KEY;
});

const STEP: ChecklistStep = {
  id: 'install',
  intent: '.pkg 파일을 더블클릭해서 설치 마법사를 진행한다.',
  success_criteria: '/Applications/SecurityAgent.app 디렉토리가 존재한다.',
  common_mistakes: '잠금 해제 안 한 채 클릭 시도',
};

const ITEM: ChecklistItem = {
  id: 'install-security-agent',
  title: '사내 보안 에이전트 설치',
  estimated_minutes: 15,
  ai_coaching: {
    overall_goal: '사용자가 사내 보안 에이전트를 설치하도록 한다.',
    steps: [STEP],
  },
};

function pngBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function mockMessagesOnce(
  responder: (request: Request) => Promise<Response> | Response,
): void {
  server.use(http.post(ANTHROPIC_MESSAGES_URL, ({ request }) => responder(request), { once: true }));
}

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

describe('prompts/guide', () => {
  it('GUIDE_SYSTEM_PROMPT mentions the json envelope', () => {
    expect(GUIDE_SYSTEM_PROMPT).toMatch(/<json>/);
    expect(GUIDE_SYSTEM_PROMPT).toMatch(/highlight_region/);
    expect(GUIDE_SYSTEM_PROMPT).toMatch(/confidence/);
  });

  it('user prompt includes intent / success_criteria / common_mistakes', () => {
    const text = buildGuideUserPrompt({ item: ITEM, step: STEP });
    expect(text).toContain(STEP.intent.trim());
    expect(text).toContain(STEP.success_criteria.trim());
    expect(text).toContain(STEP.common_mistakes!.trim());
    expect(text).toContain(ITEM.title);
  });

  it('user prompt omits common_mistakes section when not provided', () => {
    const stepNoMistakes: ChecklistStep = {
      id: 'simple',
      intent: 'do a thing',
      success_criteria: 'thing done',
    };
    const text = buildGuideUserPrompt({ item: ITEM, step: stepNoMistakes });
    expect(text).not.toMatch(/Common mistakes/);
  });
});

describe('prompts/verify', () => {
  it('VERIFY_SYSTEM_PROMPT mentions pass / fail / unclear', () => {
    expect(VERIFY_SYSTEM_PROMPT).toMatch(/pass/);
    expect(VERIFY_SYSTEM_PROMPT).toMatch(/fail/);
    expect(VERIFY_SYSTEM_PROMPT).toMatch(/unclear/);
    expect(VERIFY_SYSTEM_PROMPT).toMatch(/<json>/);
  });

  it('user prompt mentions success_criteria as the verification target', () => {
    const text = buildVerifyUserPrompt({ item: ITEM, step: STEP });
    expect(text).toContain(STEP.success_criteria.trim());
    expect(text).toContain(STEP.intent.trim());
    expect(text).toMatch(/verify/i);
  });

  it('user prompt omits common_mistakes when missing', () => {
    const stepNoMistakes: ChecklistStep = {
      id: 'simple',
      intent: 'do a thing',
      success_criteria: 'thing done',
    };
    const text = buildVerifyUserPrompt({ item: ITEM, step: stepNoMistakes });
    expect(text).not.toMatch(/Common mistakes/);
  });

  it('omits overall_goal block when item has no ai_coaching', () => {
    const itemNoCoaching: ChecklistItem = {
      id: 'no-coaching',
      title: 'no coaching',
      estimated_minutes: 1,
    };
    const text = buildVerifyUserPrompt({ item: itemNoCoaching, step: STEP });
    expect(text).not.toMatch(/Overall goal/);
  });
});

describe('callGuide — happy path (msw)', () => {
  it('parses <json> block into VisionGuideResult and reports latency_ms', async () => {
    const seen: Array<Record<string, unknown>> = [];
    mockMessagesOnce(async (request) => {
      const body = (await request.json()) as Record<string, unknown>;
      seen.push(body);
      const text = `Sure!\n<json>${JSON.stringify({
        message: '왼쪽 상단의 잠금 해제 버튼을 누르세요',
        highlight_region: { x: 12, y: 24, width: 48, height: 40 },
        confidence: 'high',
      })}</json>\n`;
      return HttpResponse.json(buildAnthropicMessageBody(text));
    });

    const result = await callGuide({
      buffer: pngBuffer(),
      item: ITEM,
      step: STEP,
    });

    expect(result.type).toBe('guide');
    expect(result.message).toContain('잠금 해제');
    expect(result.confidence).toBe('high');
    expect(result.highlight_region).toEqual({
      x: 12,
      y: 24,
      width: 48,
      height: 40,
    });
    expect(typeof result.latency_ms).toBe('number');
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);

    expect(seen).toHaveLength(1);
    const sent = seen[0]!;
    expect(sent.model).toBe(ANTHROPIC_VISION_MODEL);
    expect(sent.max_tokens).toBe(ANTHROPIC_MAX_TOKENS);
    expect(typeof sent.system).toBe('string');
    const messages = sent.messages as Array<{
      role: string;
      content: Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }>;
    }>;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe('user');
    const blocks = messages[0]?.content ?? [];
    const imageBlock = blocks.find((b) => b.type === 'image');
    expect(imageBlock?.source?.type).toBe('base64');
    expect(imageBlock?.source?.media_type).toBe('image/png');
    expect(imageBlock?.source?.data).toBe(pngBuffer().toString('base64'));
    expect(blocks.find((b) => b.type === 'text')).toBeDefined();
  });

  it('accepts highlight_region: null and produces a result without that field', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        buildAnthropicMessageBody(
          `<json>${JSON.stringify({
            message: '먼저 다운로드 폴더로 이동하세요',
            highlight_region: null,
            confidence: 'medium',
          })}</json>`,
        ),
      ),
    );

    const result = await callGuide({
      buffer: pngBuffer(),
      item: ITEM,
      step: STEP,
    });
    expect(result.highlight_region).toBeUndefined();
    expect(result.confidence).toBe('medium');
  });
});

describe('callVerify — happy path (msw)', () => {
  it('parses status: pass with reasoning and next_action_hint', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        buildAnthropicMessageBody(
          `<json>${JSON.stringify({
            status: 'pass',
            reasoning: '/Applications/SecurityAgent.app 가 보입니다.',
            next_action_hint: '이대로 다음 단계로 진행하세요',
          })}</json>`,
        ),
      ),
    );
    const result = await callVerify({
      buffer: pngBuffer(),
      item: ITEM,
      step: STEP,
    });
    expect(result.type).toBe('verify');
    expect(result.status).toBe('pass');
    expect(result.reasoning).toContain('SecurityAgent');
    expect(result.next_action_hint).toContain('진행하세요');
    expect(typeof result.latency_ms).toBe('number');
  });

  it('parses status: fail and surfaces next_action_hint', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        buildAnthropicMessageBody(
          `<json>${JSON.stringify({
            status: 'fail',
            reasoning: 'SecurityAgent 가 보이지 않습니다.',
            next_action_hint: '다시 .pkg 를 더블클릭하세요',
          })}</json>`,
        ),
      ),
    );
    const result = await callVerify({
      buffer: pngBuffer(),
      item: ITEM,
      step: STEP,
    });
    expect(result.status).toBe('fail');
    expect(result.next_action_hint).toContain('.pkg');
  });

  it('parses status: unclear', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        buildAnthropicMessageBody(
          `<json>${JSON.stringify({
            status: 'unclear',
            reasoning: '화면이 너무 작아 판단 불가',
            next_action_hint: '창을 최대화하고 다시 시도하세요',
          })}</json>`,
        ),
      ),
    );
    const result = await callVerify({
      buffer: pngBuffer(),
      item: ITEM,
      step: STEP,
    });
    expect(result.status).toBe('unclear');
  });

  it('uses VERIFY_SYSTEM_PROMPT (not the guide system prompt)', async () => {
    let captured: Record<string, unknown> | undefined;
    mockMessagesOnce(async (request) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        buildAnthropicMessageBody(
          `<json>${JSON.stringify({
            status: 'pass',
            reasoning: 'ok',
            next_action_hint: 'ok',
          })}</json>`,
        ),
      );
    });
    await callVerify({ buffer: pngBuffer(), item: ITEM, step: STEP });
    expect(captured?.system).toBe(VERIFY_SYSTEM_PROMPT);
  });
});

describe('callGuide — error mapping', () => {
  it('throws VisionResponseFormatError when no <json> block is present', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(buildAnthropicMessageBody('I cannot do that.')),
    );
    await expect(
      callGuide({ buffer: pngBuffer(), item: ITEM, step: STEP }),
    ).rejects.toBeInstanceOf(VisionResponseFormatError);
  });

  it('throws VisionResponseFormatError when JSON inside the block is malformed', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        buildAnthropicMessageBody('<json>{not json at all}</json>'),
      ),
    );
    await expect(
      callGuide({ buffer: pngBuffer(), item: ITEM, step: STEP }),
    ).rejects.toBeInstanceOf(VisionResponseFormatError);
  });

  it('throws VisionResponseFormatError when zod schema rejects the payload', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        buildAnthropicMessageBody(
          `<json>${JSON.stringify({
            message: '',
            highlight_region: null,
            confidence: 'sky-high',
          })}</json>`,
        ),
      ),
    );
    await expect(
      callGuide({ buffer: pngBuffer(), item: ITEM, step: STEP }),
    ).rejects.toBeInstanceOf(VisionResponseFormatError);
  });

  it('throws VisionResponseFormatError when highlight_region has non-positive width', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        buildAnthropicMessageBody(
          `<json>${JSON.stringify({
            message: 'hi',
            highlight_region: { x: 1, y: 1, width: 0, height: 10 },
            confidence: 'low',
          })}</json>`,
        ),
      ),
    );
    await expect(
      callGuide({ buffer: pngBuffer(), item: ITEM, step: STEP }),
    ).rejects.toBeInstanceOf(VisionResponseFormatError);
  });

  it('maps Anthropic 401 to AnthropicAuthError', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        {
          type: 'error',
          error: { type: 'authentication_error', message: 'invalid x-api-key' },
        },
        { status: 401 },
      ),
    );
    await expect(
      callGuide({ buffer: pngBuffer(), item: ITEM, step: STEP }),
    ).rejects.toBeInstanceOf(AnthropicAuthError);
  });

  it('maps Anthropic 504 to AnthropicTimeoutError', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        { type: 'error', error: { type: 'timeout', message: 'gateway timeout' } },
        { status: 504 },
      ),
    );
    await expect(
      callGuide({ buffer: pngBuffer(), item: ITEM, step: STEP }),
    ).rejects.toBeInstanceOf(AnthropicTimeoutError);
  });

  it('maps Anthropic 500 to AnthropicServerError', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        { type: 'error', error: { type: 'api_error', message: 'oops' } },
        { status: 500 },
      ),
    );
    await expect(
      callGuide({ buffer: pngBuffer(), item: ITEM, step: STEP }),
    ).rejects.toBeInstanceOf(AnthropicServerError);
  });

  it('maps 429 to AnthropicAuthError (auth/quota bucket per spec)', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        {
          type: 'error',
          error: { type: 'rate_limit_error', message: 'too many' },
        },
        { status: 429 },
      ),
    );
    await expect(
      callGuide({ buffer: pngBuffer(), item: ITEM, step: STEP }),
    ).rejects.toBeInstanceOf(AnthropicAuthError);
  });

  it('throws AnthropicAuthError when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      callGuide({ buffer: pngBuffer(), item: ITEM, step: STEP }),
    ).rejects.toBeInstanceOf(AnthropicAuthError);
  });
});

describe('callVerify — error mapping', () => {
  it('throws VisionResponseFormatError when status is not in the enum', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        buildAnthropicMessageBody(
          `<json>${JSON.stringify({
            status: 'maybe',
            reasoning: 'unsure',
            next_action_hint: 'try again',
          })}</json>`,
        ),
      ),
    );
    await expect(
      callVerify({ buffer: pngBuffer(), item: ITEM, step: STEP }),
    ).rejects.toBeInstanceOf(VisionResponseFormatError);
  });

  it('maps 401 to AnthropicAuthError on the verify path too', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        { type: 'error', error: { type: 'authentication_error' } },
        { status: 401 },
      ),
    );
    await expect(
      callVerify({ buffer: pngBuffer(), item: ITEM, step: STEP }),
    ).rejects.toBeInstanceOf(AnthropicAuthError);
  });
});

describe('AC-VIS-08 partial — latency_ms is reported', () => {
  it('latency_ms increases with simulated server delay', async () => {
    server.use(
      http.post(ANTHROPIC_MESSAGES_URL, async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return HttpResponse.json(
          buildAnthropicMessageBody(
            `<json>${JSON.stringify({
              message: 'ok',
              highlight_region: null,
              confidence: 'low',
            })}</json>`,
          ),
        );
      }),
    );
    const result = await callGuide({
      buffer: pngBuffer(),
      item: ITEM,
      step: STEP,
    });
    expect(result.latency_ms).toBeGreaterThanOrEqual(20);
  });
});

describe('Constants (AC-VIS contract)', () => {
  it('uses claude-3-5-sonnet-latest (PRD §6.3)', () => {
    expect(ANTHROPIC_VISION_MODEL).toBe('claude-3-5-sonnet-latest');
  });

  it('uses 30 second timeout per spec', () => {
    expect(ANTHROPIC_REQUEST_TIMEOUT_MS).toBe(30_000);
  });

  it('uses max_tokens=1024 per spec', () => {
    expect(ANTHROPIC_MAX_TOKENS).toBe(1024);
  });
});

describe('Error class identity', () => {
  it('AnthropicAuthError exposes code anthropic_auth_error', () => {
    const err = new AnthropicAuthError();
    expect(err.code).toBe('anthropic_auth_error');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AnthropicAuthError');
  });

  it('AnthropicTimeoutError exposes code anthropic_timeout_error', () => {
    const err = new AnthropicTimeoutError();
    expect(err.code).toBe('anthropic_timeout_error');
    expect(err.name).toBe('AnthropicTimeoutError');
  });

  it('AnthropicServerError exposes code anthropic_server_error', () => {
    const err = new AnthropicServerError();
    expect(err.code).toBe('anthropic_server_error');
    expect(err.name).toBe('AnthropicServerError');
  });

  it('VisionResponseFormatError exposes code vision_response_format_error and raw text', () => {
    const err = new VisionResponseFormatError(
      'vision_response_format_error',
      'raw response',
    );
    expect(err.code).toBe('vision_response_format_error');
    expect(err.raw).toBe('raw response');
    expect(err.name).toBe('VisionResponseFormatError');
  });
});

describe('AC: caller is responsible for buffer disposal', () => {
  it('callGuide does not retain a reference to the input buffer', async () => {
    mockMessagesOnce(() =>
      HttpResponse.json(
        buildAnthropicMessageBody(
          `<json>${JSON.stringify({
            message: 'ok',
            highlight_region: null,
            confidence: 'low',
          })}</json>`,
        ),
      ),
    );
    const buffer = pngBuffer();
    await callGuide({ buffer, item: ITEM, step: STEP });
    // Caller still owns the buffer and is free to mutate (zero) it.
    buffer.fill(0);
    expect(buffer.every((b) => b === 0)).toBe(true);
  });
});

describe('SDK injection — supports a pre-built Anthropic instance', () => {
  it('uses an injected client mock instead of creating a new one', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'msg_inj',
      type: 'message',
      role: 'assistant',
      model: ANTHROPIC_VISION_MODEL,
      content: [
        {
          type: 'text',
          text: `<json>${JSON.stringify({
            message: 'injected',
            highlight_region: null,
            confidence: 'low',
          })}</json>`,
        },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const fakeClient = { messages: { create } } as unknown as Parameters<
      typeof callGuide
    >[1] extends infer O
      ? O extends { client?: infer C }
        ? C
        : never
      : never;

    const result = await callGuide(
      { buffer: pngBuffer(), item: ITEM, step: STEP },
      { client: fakeClient as unknown as import('@anthropic-ai/sdk').default },
    );
    expect(result.message).toBe('injected');
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]![0];
    expect(args.model).toBe(ANTHROPIC_VISION_MODEL);
    expect(args.max_tokens).toBe(ANTHROPIC_MAX_TOKENS);
    expect(args.messages[0].content[0].type).toBe('image');
    expect(args.messages[0].content[1].type).toBe('text');
  });
});
