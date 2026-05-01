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

// PRD §6.3 (Claude 3.5 Sonnet Vision API). spec-010 메타.
export const ANTHROPIC_VISION_MODEL = 'claude-3-5-sonnet-latest';
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

function extractJsonBlock(raw: string): unknown {
  const match = JSON_BLOCK_RE.exec(raw);
  if (!match || match[1] === undefined) {
    throw new VisionResponseFormatError(
      'vision_response_format_error: missing <json> block',
      raw,
    );
  }
  const body = match[1].trim();
  try {
    return JSON.parse(body);
  } catch {
    throw new VisionResponseFormatError(
      'vision_response_format_error: invalid json',
      raw,
    );
  }
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

export async function callGuide(
  input: CallVisionInput,
  options: AnthropicClientOptions = {},
): Promise<CallGuideResult> {
  const client = getClient(options);
  const userPrompt = buildGuideUserPrompt({ item: input.item, step: input.step });
  const { message, latencyMs } = await callMessages(
    client,
    GUIDE_SYSTEM_PROMPT,
    userPrompt,
    input.buffer,
  );
  const text = extractText(message);
  const json = extractJsonBlock(text);
  const parsed = GuideResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new VisionResponseFormatError(
      `vision_response_format_error: ${parsed.error.message}`,
      text,
    );
  }
  const highlightRegion = parsed.data.highlight_region ?? undefined;
  const result: VisionGuideResult = {
    type: 'guide',
    message: parsed.data.message,
    confidence: parsed.data.confidence,
    ...(highlightRegion ? { highlight_region: highlightRegion } : {}),
  };
  // Round-trip through the canonical shared schema so the daemon and the rest
  // of the pipeline never disagree on shape.
  VisionGuideResultSchema.parse(result);
  return { ...result, latency_ms: latencyMs };
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
  const json = extractJsonBlock(text);
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
