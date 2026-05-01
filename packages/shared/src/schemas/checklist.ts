import { z } from 'zod';

export const ChecklistInputSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    required: z.boolean(),
  })
  .strict();

export const ClipboardInjectSchema = z
  .object({
    command: z.string().min(1),
    ui_hint: z.string().min(1).optional(),
  })
  .strict();

export const CommandVerificationSchema = z
  .object({
    type: z.literal('command'),
    command: z.string().min(1),
    expect_contains: z.string().min(1).optional(),
    poll_interval_sec: z.number().int().positive().optional(),
  })
  .strict();

export const ProcessCheckVerificationSchema = z
  .object({
    type: z.literal('process_check'),
    process_name: z.string().min(1),
    poll_interval_sec: z.number().int().positive().optional(),
  })
  .strict();

export const VerificationSchema = z.discriminatedUnion('type', [
  CommandVerificationSchema,
  ProcessCheckVerificationSchema,
]);

export const ChecklistStepSchema = z
  .object({
    id: z.string().min(1),
    intent: z.string().min(1),
    success_criteria: z.string().min(1),
    system_panel_url: z.string().min(1).optional(),
    common_mistakes: z.string().min(1).optional(),
  })
  .strict();

export const AiCoachingSchema = z
  .object({
    overall_goal: z.string().min(1),
    steps: z.array(ChecklistStepSchema).min(1),
  })
  .strict();

export const TemplateSchema = z
  .object({
    content: z.string().min(1),
    paste_target: z.string().min(1),
  })
  .strict();

export const ChecklistItemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    estimated_minutes: z.number().int().positive(),
    inputs: z.array(ChecklistInputSchema).optional(),
    clipboard_inject: ClipboardInjectSchema.optional(),
    ai_coaching: AiCoachingSchema.optional(),
    template: TemplateSchema.optional(),
    verification: VerificationSchema.optional(),
    system_panel_url: z.string().min(1).optional(),
  })
  .strict();

export const ChecklistFileSchema = z
  .object({
    version: z.number().int().positive(),
    schema: z.string().min(1),
    items: z.array(ChecklistItemSchema).min(1),
  })
  .strict();
