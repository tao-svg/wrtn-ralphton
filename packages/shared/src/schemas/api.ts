import { z } from 'zod';

import {
  CONSENT_TYPES,
  ITEM_STATUSES,
  VISION_CONFIDENCES,
  VISION_VERIFY_STATUSES,
} from '../types/index.js';
import { VerificationSchema } from './checklist.js';

// ---------------------------------------------------------------------------
// Domain primitives reused across endpoints
// ---------------------------------------------------------------------------

export const ItemIdSchema = z.string().min(1);

export const ItemStatusSchema = z.enum(ITEM_STATUSES);

export const ItemStateSchema = z
  .object({
    item_id: ItemIdSchema,
    status: ItemStatusSchema,
    current_step: z.string().min(1).nullable(),
    started_at: z.number().int().nonnegative().nullable(),
    completed_at: z.number().int().nonnegative().nullable(),
    attempt_count: z.number().int().nonnegative(),
  })
  .strict();

export const HighlightRegionSchema = z
  .object({
    x: z.number().positive(),
    y: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .strict();

export const VisionConfidenceSchema = z.enum(VISION_CONFIDENCES);

export const VisionGuideResultSchema = z
  .object({
    type: z.literal('guide'),
    message: z.string().min(1),
    highlight_region: HighlightRegionSchema.optional(),
    confidence: VisionConfidenceSchema,
  })
  .strict();

export const VisionVerifyStatusSchema = z.enum(VISION_VERIFY_STATUSES);

export const VisionVerifyResultSchema = z
  .object({
    type: z.literal('verify'),
    status: VisionVerifyStatusSchema,
    reasoning: z.string().min(1),
    next_action_hint: z.string().min(1).optional(),
  })
  .strict();

export const ConsentTypeSchema = z.enum(CONSENT_TYPES);

export const ConsentRecordSchema = z
  .object({
    consent_type: ConsentTypeSchema,
    granted: z.boolean(),
    granted_at: z.number().int().nonnegative().nullable(),
    revoked_at: z.number().int().nonnegative().nullable(),
  })
  .strict();

// ---------------------------------------------------------------------------
// 9.1.1 GET /api/checklist
// ---------------------------------------------------------------------------

export const GetChecklistResponseSchema = z
  .object({
    items: z.array(ItemStateSchema),
  })
  .strict();

// ---------------------------------------------------------------------------
// 9.1.2 POST /api/items/:itemId/start
// ---------------------------------------------------------------------------

export const StartItemParamsSchema = z
  .object({
    itemId: ItemIdSchema,
  })
  .strict();

export const StartItemResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();

// ---------------------------------------------------------------------------
// 9.1.3 POST /api/vision/guide
// ---------------------------------------------------------------------------

const VisionRequestBodySchema = z
  .object({
    item_id: ItemIdSchema,
    step_id: z.string().min(1),
  })
  .strict();

export const VisionGuideRequestSchema = VisionRequestBodySchema;

export const VisionGuideResponseSchema = z
  .object({
    call_id: z.string().min(1),
    cached: z.boolean(),
    latency_ms: z.number().int().nonnegative(),
    result: VisionGuideResultSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// 9.1.4 POST /api/vision/verify
// ---------------------------------------------------------------------------

export const VisionVerifyRequestSchema = VisionRequestBodySchema;

export const VisionVerifyResponseSchema = z
  .object({
    call_id: z.string().min(1),
    cached: z.boolean().optional(),
    latency_ms: z.number().int().nonnegative().optional(),
    result: VisionVerifyResultSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// 9.1.5 GET /api/vision/rate-limit
// ---------------------------------------------------------------------------

export const RATE_LIMIT_STATES = ['normal', 'alert', 'paused'] as const;
export const RateLimitStateSchema = z.enum(RATE_LIMIT_STATES);
export type RateLimitState = z.infer<typeof RateLimitStateSchema>;

export const RateLimitResponseSchema = z
  .object({
    current_hour_calls: z.number().int().nonnegative(),
    state: RateLimitStateSchema,
    reset_at: z.number().int().nonnegative(),
  })
  .strict();

// ---------------------------------------------------------------------------
// 9.1.6 POST/GET /api/consents
// ---------------------------------------------------------------------------

export const PostConsentRequestSchema = z
  .object({
    consent_type: ConsentTypeSchema,
    granted: z.boolean(),
  })
  .strict();

export const PostConsentResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();

export const GetConsentsResponseSchema = z
  .object({
    screen_recording: ConsentRecordSchema,
    anthropic_transmission: ConsentRecordSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// 9.1.7 POST /api/clipboard
// ---------------------------------------------------------------------------

export const ClipboardRequestSchema = z
  .object({
    command: z.string().min(1),
  })
  .strict();

export const ClipboardResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();

// ---------------------------------------------------------------------------
// 9.1.8 POST /api/verify/run
// ---------------------------------------------------------------------------

export const VerifyRunRequestSchema = z
  .object({
    item_id: ItemIdSchema,
    verification: VerificationSchema,
  })
  .strict();

export const VerifyRunResponseSchema = z
  .object({
    status: z.enum(['pass', 'fail']),
    details: z.string(),
  })
  .strict();

// ---------------------------------------------------------------------------
// P5+ System Panel Launch (PRD §7.5 F-P5P-01, AC-P5P-01)
//
// POST /api/system-panel/launch — body shape:
//   { url: string }                — launch an explicit allowlisted URL, or
//   { item_id, step_id }           — look the URL up from yaml
//
// At least one form must be provided.
// ---------------------------------------------------------------------------

export const SystemPanelLaunchRequestSchema = z
  .object({
    url: z.string().min(1).optional(),
    item_id: ItemIdSchema.optional(),
    step_id: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (data) =>
      (typeof data.url === 'string' && data.url.length > 0) ||
      (typeof data.item_id === 'string' && typeof data.step_id === 'string'),
    {
      message: 'either url or both item_id and step_id must be provided',
    },
  );

export const SystemPanelLaunchResponseSchema = z
  .object({
    ok: z.literal(true),
    url: z.string(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Error responses (PRD §9.1.3 401/403/429/503 + general API error)
// ---------------------------------------------------------------------------

export const VISION_GUIDE_ERROR_CODES = [
  'screen_recording_permission_required',
  'consent_required',
  'rate_limit_exceeded',
  'vision_api_timeout',
] as const;

export const ScreenRecordingPermissionErrorSchema = z
  .object({
    error: z.literal('screen_recording_permission_required'),
  })
  .strict();

export const ConsentRequiredErrorSchema = z
  .object({
    error: z.literal('consent_required'),
  })
  .strict();

export const RateLimitExceededErrorSchema = z
  .object({
    error: z.literal('rate_limit_exceeded'),
    state: z.literal('paused'),
    reset_at: z.number().int().nonnegative(),
  })
  .strict();

export const VisionApiTimeoutErrorSchema = z
  .object({
    error: z.literal('vision_api_timeout'),
  })
  .strict();

export const VisionGuideErrorResponseSchema = z.discriminatedUnion('error', [
  ScreenRecordingPermissionErrorSchema,
  ConsentRequiredErrorSchema,
  RateLimitExceededErrorSchema,
  VisionApiTimeoutErrorSchema,
]);
