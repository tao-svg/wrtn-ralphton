import Anthropic, { APIError } from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages';
import {
  type ChecklistItem,
  type ChecklistStep,
  HighlightRegionSchema,
  VisionConfidenceSchema,
  VisionGuideResultSchema,
  VisionVerifyResultSchema,
  VisionVerifyStatusSchema,
  type VisionGuideResult,
  type VisionVerifyResult,
} from '@onboarding/shared';
import { z } from 'zod';

import {
  buildGuideUserPrompt,
  GUIDE_SYSTEM_PROMPT,
} from './prompts/guide.js';
import {
  buildVerifyUserPrompt,
  VERIFY_SYSTEM_PROMPT,
} from './prompts/verify.js';

// PRD §6.3 originally specified Claude 3.5 Sonnet, but that ID has been retired.
// Override via VISION_MODEL env if needed. Default points at the current
// Sonnet generation.
export const ANTHROPIC_VISION_MODEL =
  process.env.VISION_MODEL ?? 'claude-sonnet-4-5';
export const ANTHROPIC_REQUEST_TIMEOUT_MS = 30_000;
export const ANTHROPIC_MAX_TOKENS = 1024;

export class AnthropicAuthError extends Error {
  readonly code = 'anthropic_auth_error';
  constructor(message = 'anthropic_auth_error', readonly status?: number) {
    super(message);
    this.name = 'AnthropicAuthError';
  }
}

export class AnthropicTimeoutError extends Error {
  readonly code = 'anthropic_timeout_error';
  constructor(message = 'anthropic_timeout_error') {
    super(message);
    this.name = 'AnthropicTimeoutError';
  }
}

export class AnthropicServerError extends Error {
  readonly code = 'anthropic_server_error';
  constructor(message = 'anthropic_server_error', readonly status?: number) {
    super(message);
    this.name = 'AnthropicServerError';
  }
}

export class VisionResponseFormatError extends Error {
  readonly code = 'vision_response_format_error';
  constructor(
    message = 'vision_response_format_error',
    readonly raw?: string,
  ) {
    super(message);
    this.name = 'VisionResponseFormatError';
  }
}

export interface CallVisionInput {
  buffer: Buffer;
  item: ChecklistItem;
  step: ChecklistStep;
}

// AC-VIS-08 부분 충족: latency 측정.
export interface CallGuideResult extends VisionGuideResult {
  latency_ms: number;
}

export interface CallVerifyResult extends VisionVerifyResult {
  latency_ms: number;
}

export interface AnthropicClientOptions {
  client?: Anthropic;
  apiKey?: string;
  baseURL?: string;
}

function getClient(options: AnthropicClientOptions = {}): Anthropic {
  if (options.client) return options.client;
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length === 0) {
    throw new AnthropicAuthError('anthropic_api_key_missing');
  }
  return new Anthropic({
    apiKey,
    baseURL: options.baseURL,
    timeout: ANTHROPIC_REQUEST_TIMEOUT_MS,
    maxRetries: 0,
  });
}

function extractText(message: Message): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === 'text') {
      parts.push(block.text);
    }
  }
  return parts.join('\n');
}

const JSON_BLOCK_RE = /<json>([\s\S]*?)<\/json>/i;
const FENCED_JSON_RE = /```(?:json)?\s*([\s\S]*?)\s*```/i;
const RAW_OBJECT_RE = /\{[\s\S]*\}/;

function extractJsonBlock(raw: string): unknown {
  // Sonnet 4.5 sometimes drops the `<json>` tag and returns a fenced or raw
  // JSON object instead, so accept three shapes in priority order.
  const candidates = [
    JSON_BLOCK_RE.exec(raw)?.[1],
    FENCED_JSON_RE.exec(raw)?.[1],
    RAW_OBJECT_RE.exec(raw)?.[0],
  ];
  for (const body of candidates) {
    if (typeof body !== 'string') continue;
    const trimmed = body.trim();
    if (!trimmed) continue;
    try {
      return JSON.parse(trimmed);
    } catch {
      // try the next shape
    }
  }
  throw new VisionResponseFormatError(
    'vision_response_format_error: no parseable JSON block',
    raw,
  );
}

// Sonnet 4.5는 응답마다 highlight_region을 `{x,y,width,height}` 또는
// `{x,y,w,h}` 둘 중 하나로 반환 — 같은 prompt에도 일관성이 없다.
// zod schema는 width/height만 받으므로 w/h를 풀 이름으로 정규화.
function normalizeJson(json: unknown): unknown {
  if (typeof json !== 'object' || json === null) return json;
  const obj = json as Record<string, unknown>;
  const r = obj.highlight_region;
  if (r && typeof r === 'object') {
    const region = r as Record<string, unknown>;
    if (region.w !== undefined && region.width === undefined) {
      region.width = region.w;
    }
    if (region.h !== undefined && region.height === undefined) {
      region.height = region.h;
    }
    delete region.w;
    delete region.h;
  }
  return json;
}

// 응답 JSON: { message, highlight_region: {x,y,width,height} | null, confidence }
const GuideResponseSchema = z
  .object({
    message: z.string().min(1),
    highlight_region: HighlightRegionSchema.nullish(),
    confidence: VisionConfidenceSchema,
  })
  .strict();

// 응답 JSON: { status, reasoning, next_action_hint }
const VerifyResponseSchema = z
  .object({
    status: VisionVerifyStatusSchema,
    reasoning: z.string().min(1),
    next_action_hint: z.string().min(1),
  })
  .strict();

function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

function mapApiError(err: unknown): never {
  // SDK timeout (no status) maps to AnthropicTimeoutError.
  if (err instanceof APIError) {
    const status = err.status;
    if (status === undefined) {
      throw new AnthropicTimeoutError(`anthropic_timeout_error: ${err.message}`);
    }
    if (status === 408 || status === 504) {
      throw new AnthropicTimeoutError(
        `anthropic_timeout_error: status=${status}`,
      );
    }
    if (status >= 500) {
      throw new AnthropicServerError(
        `anthropic_server_error: status=${status}`,
        status,
      );
    }
    if (status === 401 || status === 403 || status === 429) {
      throw new AnthropicAuthError(
        `anthropic_auth_error: status=${status}`,
        status,
      );
    }
    if (status >= 400 && status < 500) {
      throw new AnthropicAuthError(
        `anthropic_auth_error: status=${status}`,
        status,
      );
    }
  }
  if (err instanceof Error && /timeout|aborted/i.test(err.message)) {
    throw new AnthropicTimeoutError(`anthropic_timeout_error: ${err.message}`);
  }
  throw err;
}

async function callMessages(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  buffer: Buffer,
): Promise<{ message: Message; latencyMs: number }> {
  const startedAt = Date.now();
  try {
    const message = await client.messages.create({
      model: ANTHROPIC_VISION_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: bufferToBase64(buffer),
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    });
    return { message, latencyMs: Date.now() - startedAt };
  } catch (err) {
    mapApiError(err);
  }
}

// reference impl(ralph-floating-hint)에서 가져온 2-pass refine 기법:
// 1차로 전체 화면에서 대략적 위치를 잡고, 그 주변을 sharp로 crop해서 모델에
// 좁은 영역만 다시 보여주면 픽셀 정확도가 눈에 띄게 올라간다.
async function cropAround(
  raw: Buffer,
  region: { x: number; y: number; width: number; height: number },
): Promise<{
  cropBuffer: Buffer;
  cropRect: { x: number; y: number; width: number; height: number };
}> {
  const sharpMod = (await import('sharp')).default;
  const meta = await sharpMod(raw).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (W === 0 || H === 0) {
    throw new Error('cropAround: cannot read image dimensions');
  }
  // 1차 박스의 4배(중심 유지), 최소 30% / 최대 60% 화면.
  const targetW = Math.min(W * 0.6, Math.max(W * 0.3, region.width * 4));
  const targetH = Math.min(H * 0.6, Math.max(H * 0.3, region.height * 4));
  const cx = region.x + region.width / 2;
  const cy = region.y + region.height / 2;
  let x = Math.round(cx - targetW / 2);
  let y = Math.round(cy - targetH / 2);
  x = Math.max(0, Math.min(W - Math.round(targetW), x));
  y = Math.max(0, Math.min(H - Math.round(targetH), y));
  const w = Math.min(Math.round(targetW), W - x);
  const h = Math.min(Math.round(targetH), H - y);
  const cropBuffer = await sharpMod(raw)
    .extract({ left: x, top: y, width: w, height: h })
    .png()
    .toBuffer();
  return { cropBuffer, cropRect: { x, y, width: w, height: h } };
}

export async function callGuide(
  input: CallVisionInput,
  options: AnthropicClientOptions = {},
): Promise<CallGuideResult> {
  const client = getClient(options);
  const userPrompt = buildGuideUserPrompt({ item: input.item, step: input.step });

  // Pass 1: 전체 화면에서 대략적 좌표
  const { message: msg1, latencyMs: t1 } = await callMessages(
    client,
    GUIDE_SYSTEM_PROMPT,
    userPrompt,
    input.buffer,
  );
  const text1 = extractText(msg1);
  const json1 = normalizeJson(extractJsonBlock(text1));
  const parsed1 = GuideResponseSchema.safeParse(json1);
  if (!parsed1.success) {
    throw new VisionResponseFormatError(
      `vision_response_format_error: ${parsed1.error.message}`,
      text1,
    );
  }

  let finalMessage = parsed1.data.message;
  let finalConfidence = parsed1.data.confidence;
  let finalRegion = parsed1.data.highlight_region ?? undefined;
  let totalLatency = t1;

  // Pass 2: 1차에서 region이 있으면 그 주변만 crop해서 재추론
  if (finalRegion) {
    try {
      const { cropBuffer, cropRect } = await cropAround(input.buffer, finalRegion);
      const refinePrompt = `${userPrompt}\n\nNOTE: This is a CROPPED region of the previous screenshot.\nRe-locate the exact same target with pixel precision. Coordinates in the JSON response must be relative to THIS crop image (not the original).`;
      const { message: msg2, latencyMs: t2 } = await callMessages(
        client,
        GUIDE_SYSTEM_PROMPT,
        refinePrompt,
        cropBuffer,
      );
      totalLatency += t2;
      const text2 = extractText(msg2);
      const json2 = normalizeJson(extractJsonBlock(text2));
      const parsed2 = GuideResponseSchema.safeParse(json2);
      if (parsed2.success && parsed2.data.highlight_region) {
        const r = parsed2.data.highlight_region;
        finalRegion = {
          x: cropRect.x + r.x,
          y: cropRect.y + r.y,
          width: r.width,
          height: r.height,
        };
        if (parsed2.data.confidence) finalConfidence = parsed2.data.confidence;
        if (parsed2.data.message) finalMessage = parsed2.data.message;
      }
    } catch {
      // Pass 2 실패는 1차 결과 그대로 사용 — 데모 멈추지 않도록.
    }
  }

  const result: VisionGuideResult = {
    type: 'guide',
    message: finalMessage,
    confidence: finalConfidence,
    ...(finalRegion ? { highlight_region: finalRegion } : {}),
  };
  VisionGuideResultSchema.parse(result);
  return { ...result, latency_ms: totalLatency };
}

export async function callVerify(
  input: CallVisionInput,
  options: AnthropicClientOptions = {},
): Promise<CallVerifyResult> {
  const client = getClient(options);
  const userPrompt = buildVerifyUserPrompt({ item: input.item, step: input.step });
  const { message, latencyMs } = await callMessages(
    client,
    VERIFY_SYSTEM_PROMPT,
    userPrompt,
    input.buffer,
  );
  const text = extractText(message);
  const json = normalizeJson(extractJsonBlock(text));
  const parsed = VerifyResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new VisionResponseFormatError(
      `vision_response_format_error: ${parsed.error.message}`,
      text,
    );
  }
  const result: VisionVerifyResult = {
    type: 'verify',
    status: parsed.data.status,
    reasoning: parsed.data.reasoning,
    next_action_hint: parsed.data.next_action_hint,
  };
  VisionVerifyResultSchema.parse(result);
  return { ...result, latency_ms: latencyMs };
}
