import { randomUUID } from 'node:crypto';

import type {
  ChecklistFile,
  ChecklistItem,
  ChecklistStep,
  VisionGuideResult,
  VisionVerifyResult,
} from '@onboarding/shared';
import type { Logger } from 'pino';

import type { DatabaseInstance } from '../db/index.js';
import {
  callGuide,
  callVerify,
  type AnthropicClientOptions,
  type CallGuideResult,
  type CallVerifyResult,
} from './anthropic-client.js';
import {
  buildCacheKey,
  type VisionCache,
  type VisionRequestType,
} from './cache.js';
import { captureScreen, type CaptureResult } from './capture.js';
import { type VisionDebounce } from './debounce.js';
import { disposeBuffer } from './dispose.js';
import { type RateLimit } from './rate-limit.js';

// PRD §9.1.3 / §9.1.4 — orchestrator stitches capture + cache + rate-limit +
// debounce + Anthropic SDK + vision_calls audit row into one call.

export class VisionItemNotFoundError extends Error {
  readonly code = 'item_not_found';
  constructor(public readonly itemId: string) {
    super(`item_not_found: ${itemId}`);
    this.name = 'VisionItemNotFoundError';
  }
}

export class VisionStepNotFoundError extends Error {
  readonly code = 'step_not_found';
  constructor(
    public readonly itemId: string,
    public readonly stepId: string,
  ) {
    super(`step_not_found: ${itemId}/${stepId}`);
    this.name = 'VisionStepNotFoundError';
  }
}

export class RateLimitPausedError extends Error {
  readonly code = 'rate_limit_paused';
  constructor(
    public readonly resetAt: number,
    public readonly currentHourCalls: number,
  ) {
    super('rate_limit_paused');
    this.name = 'RateLimitPausedError';
  }
}

export type CaptureFn = () => Promise<CaptureResult>;
export type GuideClientFn = typeof callGuide;
export type VerifyClientFn = typeof callVerify;

export interface VisionGuideResponse {
  call_id: string;
  cached: boolean;
  latency_ms: number;
  result: VisionGuideResult;
}

export interface VisionVerifyResponse {
  call_id: string;
  cached: boolean;
  latency_ms: number;
  result: VisionVerifyResult;
}

export interface VisionRequestInput {
  itemId: string;
  stepId: string;
}

export interface VisionOrchestratorDeps {
  checklist: ChecklistFile;
  db: DatabaseInstance;
  cache: VisionCache;
  rateLimit: RateLimit;
  debounce: VisionDebounce;
  capture?: CaptureFn;
  guideClient?: GuideClientFn;
  verifyClient?: VerifyClientFn;
  anthropicOptions?: AnthropicClientOptions;
  now?: () => number;
  logger?: Logger;
}

export interface VisionOrchestrator {
  runGuide(req: VisionRequestInput): Promise<VisionGuideResponse>;
  runVerify(req: VisionRequestInput): Promise<VisionVerifyResponse>;
}

interface ResolvedRequest {
  item: ChecklistItem;
  step: ChecklistStep;
}

const SUMMARY_MAX_LEN = 512;

function newCallId(): string {
  return `vc_${randomUUID()}`;
}

function summarizeGuide(result: VisionGuideResult): string {
  const region = result.highlight_region;
  const regionPart = region
    ? `region=${region.x},${region.y},${region.width}x${region.height}`
    : 'region=null';
  return [result.message, `confidence=${result.confidence}`, regionPart]
    .join(' | ')
    .slice(0, SUMMARY_MAX_LEN);
}

function summarizeVerify(result: VisionVerifyResult): string {
  const hint = result.next_action_hint ?? '';
  return `status=${result.status} | ${result.reasoning} | hint=${hint}`.slice(
    0,
    SUMMARY_MAX_LEN,
  );
}

function pickGuideResult(raw: CallGuideResult): VisionGuideResult {
  const base: VisionGuideResult = {
    type: 'guide',
    message: raw.message,
    confidence: raw.confidence,
  };
  if (raw.highlight_region !== undefined) {
    base.highlight_region = raw.highlight_region;
  }
  return base;
}

function pickVerifyResult(raw: CallVerifyResult): VisionVerifyResult {
  const base: VisionVerifyResult = {
    type: 'verify',
    status: raw.status,
    reasoning: raw.reasoning,
  };
  if (raw.next_action_hint !== undefined) {
    base.next_action_hint = raw.next_action_hint;
  }
  return base;
}

function errorCode(err: unknown): string {
  if (err && typeof err === 'object') {
    const candidate = (err as { code?: unknown }).code;
    if (typeof candidate === 'string') return candidate;
  }
  if (err instanceof Error) return err.name;
  return 'unknown';
}

function markItemCompleted(
  db: DatabaseInstance,
  itemId: string,
  now: number,
): void {
  db.prepare(
    `INSERT INTO item_states
       (item_id, status, current_step, started_at, completed_at, attempt_count)
     VALUES (@item_id, 'completed', NULL, NULL, @now, 1)
     ON CONFLICT(item_id) DO UPDATE SET
       status        = 'completed',
       completed_at  = @now,
       attempt_count = item_states.attempt_count + 1`,
  ).run({ item_id: itemId, now });
}

interface InsertVisionCallParams {
  callId: string;
  itemId: string;
  stepId: string;
  requestType: VisionRequestType;
  imageHash: string;
  promptTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  cacheHit: boolean;
  resultSummary: string | null;
  error: string | null;
  createdAt: number;
}

function insertVisionCall(
  db: DatabaseInstance,
  params: InsertVisionCallParams,
): void {
  db.prepare(
    `INSERT INTO vision_calls
       (call_id, item_id, step_id, request_type, image_hash,
        prompt_tokens, output_tokens, latency_ms, cache_hit,
        result_summary, error, created_at)
     VALUES (@call_id, @item_id, @step_id, @request_type, @image_hash,
             @prompt_tokens, @output_tokens, @latency_ms, @cache_hit,
             @result_summary, @error, @created_at)`,
  ).run({
    call_id: params.callId,
    item_id: params.itemId,
    step_id: params.stepId,
    request_type: params.requestType,
    image_hash: params.imageHash,
    prompt_tokens: params.promptTokens,
    output_tokens: params.outputTokens,
    latency_ms: params.latencyMs,
    cache_hit: params.cacheHit ? 1 : 0,
    result_summary: params.resultSummary,
    error: params.error,
    created_at: params.createdAt,
  });
}

export function createVisionOrchestrator(
  deps: VisionOrchestratorDeps,
): VisionOrchestrator {
  const now = deps.now ?? Date.now;
  const captureFn: CaptureFn = deps.capture ?? (() => captureScreen());
  const guideClient = deps.guideClient ?? callGuide;
  const verifyClient = deps.verifyClient ?? callVerify;
  const anthropicOptions: AnthropicClientOptions = deps.anthropicOptions ?? {};

  function resolve(itemId: string, stepId: string): ResolvedRequest {
    const item = deps.checklist.items.find((i) => i.id === itemId);
    if (!item) throw new VisionItemNotFoundError(itemId);
    const step = item.ai_coaching?.steps.find((s) => s.id === stepId);
    if (!step) throw new VisionStepNotFoundError(itemId, stepId);
    return { item, step };
  }

  function gateRateLimit(): void {
    const result = deps.rateLimit.checkAndIncrement();
    if (!result.allowed) {
      throw new RateLimitPausedError(
        result.reset_at,
        result.current_hour_calls,
      );
    }
  }

  async function withCapture<T>(
    fn: (cap: CaptureResult) => Promise<T>,
  ): Promise<T> {
    const cap = await captureFn();
    try {
      return await fn(cap);
    } finally {
      // PRD AC-VIS-07 — wipe the captured image bytes the moment we are done.
      disposeBuffer(cap.buffer);
    }
  }

  return {
    async runGuide({ itemId, stepId }) {
      const resolved = resolve(itemId, stepId);
      const debounceKey = `guide:${itemId}:${stepId}`;
      deps.debounce.check(debounceKey);
      gateRateLimit();
      const startedAt = now();
      const callId = newCallId();

      return withCapture(async (cap) => {
        const cacheKey = buildCacheKey({
          requestType: 'guide',
          itemId,
          stepId,
          imageHash: cap.hash,
        });
        const hit = deps.cache.getCached(cacheKey);
        if (hit && hit.type === 'guide') {
          return {
            call_id: callId,
            cached: true,
            latency_ms: now() - startedAt,
            result: hit,
          };
        }

        let raw: CallGuideResult;
        try {
          raw = await guideClient(
            { buffer: cap.buffer, item: resolved.item, step: resolved.step },
            anthropicOptions,
          );
        } catch (err) {
          insertVisionCall(deps.db, {
            callId,
            itemId,
            stepId,
            requestType: 'guide',
            imageHash: cap.hash,
            promptTokens: null,
            outputTokens: null,
            latencyMs: now() - startedAt,
            cacheHit: false,
            resultSummary: null,
            error: errorCode(err),
            createdAt: now(),
          });
          deps.logger?.warn(
            { err, item_id: itemId, step_id: stepId },
            'vision_guide_call_failed',
          );
          throw err;
        }

        const result = pickGuideResult(raw);
        deps.cache.setCached(cacheKey, result);
        const latency = now() - startedAt;
        insertVisionCall(deps.db, {
          callId,
          itemId,
          stepId,
          requestType: 'guide',
          imageHash: cap.hash,
          promptTokens: null,
          outputTokens: null,
          latencyMs: latency,
          cacheHit: false,
          resultSummary: summarizeGuide(result),
          error: null,
          createdAt: now(),
        });
        return {
          call_id: callId,
          cached: false,
          latency_ms: latency,
          result,
        };
      });
    },

    async runVerify({ itemId, stepId }) {
      const resolved = resolve(itemId, stepId);
      const debounceKey = `verify:${itemId}:${stepId}`;
      deps.debounce.check(debounceKey);
      gateRateLimit();
      const startedAt = now();
      const callId = newCallId();

      const response = await withCapture<VisionVerifyResponse>(async (cap) => {
        const cacheKey = buildCacheKey({
          requestType: 'verify',
          itemId,
          stepId,
          imageHash: cap.hash,
        });
        const hit = deps.cache.getCached(cacheKey);
        if (hit && hit.type === 'verify') {
          return {
            call_id: callId,
            cached: true,
            latency_ms: now() - startedAt,
            result: hit,
          };
        }

        let raw: CallVerifyResult;
        try {
          raw = await verifyClient(
            { buffer: cap.buffer, item: resolved.item, step: resolved.step },
            anthropicOptions,
          );
        } catch (err) {
          insertVisionCall(deps.db, {
            callId,
            itemId,
            stepId,
            requestType: 'verify',
            imageHash: cap.hash,
            promptTokens: null,
            outputTokens: null,
            latencyMs: now() - startedAt,
            cacheHit: false,
            resultSummary: null,
            error: errorCode(err),
            createdAt: now(),
          });
          deps.logger?.warn(
            { err, item_id: itemId, step_id: stepId },
            'vision_verify_call_failed',
          );
          throw err;
        }

        const result = pickVerifyResult(raw);
        deps.cache.setCached(cacheKey, result);
        const latency = now() - startedAt;
        insertVisionCall(deps.db, {
          callId,
          itemId,
          stepId,
          requestType: 'verify',
          imageHash: cap.hash,
          promptTokens: null,
          outputTokens: null,
          latencyMs: latency,
          cacheHit: false,
          resultSummary: summarizeVerify(result),
          error: null,
          createdAt: now(),
        });
        return {
          call_id: callId,
          cached: false,
          latency_ms: latency,
          result,
        };
      });

      // PRD §10 AC-VIS-02 — when verify says pass, auto-mark the item complete.
      if (response.result.status === 'pass') {
        markItemCompleted(deps.db, itemId, now());
      }
      return response;
    },
  };
}
