import type { ChecklistItem, ChecklistStep } from '@onboarding/shared';

// PRD §7.7 F-P8-03 (별도 프롬프트 사용), §11 (step 객체 intent / success_criteria
// / common_mistakes를 그대로 프롬프트에 옮긴다).
export const GUIDE_SYSTEM_PROMPT = `You are an onboarding coach for a new employee on macOS.
The user has just sent a screenshot of their current screen.
Your job is to look at the screenshot and tell the user the *next* concrete action they should take to make progress on the current step.

Output requirements (strict):
- Reply with a single fenced JSON block: <json>{ ... }</json>.
- Schema: { "message": string, "highlight_region": { "x": number, "y": number, "width": number, "height": number } | null, "confidence": "high" | "medium" | "low" }.
- "message" must be a short, friendly Korean sentence telling the user what to do next.
- "highlight_region" should point at the UI element the user must click / look at, in pixel coordinates of the supplied screenshot. Use null when no region is appropriate.
- "confidence" reports how sure you are.
- Do not output anything outside the <json>...</json> block.`;

export interface GuidePromptInput {
  item: ChecklistItem;
  step: ChecklistStep;
}

export function buildGuideUserPrompt({ item, step }: GuidePromptInput): string {
  const lines: string[] = [];
  lines.push(`# Onboarding item: ${item.title} (id=${item.id})`);
  if (item.ai_coaching?.overall_goal) {
    lines.push('');
    lines.push('## Overall goal');
    lines.push(item.ai_coaching.overall_goal.trim());
  }
  lines.push('');
  lines.push(`## Current step: ${step.id}`);
  lines.push('');
  lines.push('### Intent');
  lines.push(step.intent.trim());
  lines.push('');
  lines.push('### Success criteria');
  lines.push(step.success_criteria.trim());
  if (step.common_mistakes && step.common_mistakes.trim().length > 0) {
    lines.push('');
    lines.push('### Common mistakes');
    lines.push(step.common_mistakes.trim());
  }
  lines.push('');
  lines.push(
    'Look at the attached screenshot and tell me, in Korean, the single next action I should take. Reply only with the <json>...</json> block.',
  );
  return lines.join('\n');
}
