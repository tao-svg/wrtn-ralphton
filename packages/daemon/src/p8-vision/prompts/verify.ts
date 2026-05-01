import type { ChecklistItem, ChecklistStep } from '@onboarding/shared';

// PRD §7.7 F-P8-05 — Vision이 PASS / FAIL / UNCLEAR 직접 판정.
// PRD §11 step 객체 — success_criteria / common_mistakes 를 프롬프트로 옮긴다.
export const VERIFY_SYSTEM_PROMPT = `You are an onboarding verifier for a new employee on macOS.
The user has just finished what they believe to be the current step and has sent a screenshot.
Your job is to look at the screenshot and decide whether the step's success_criteria are visually satisfied.

Output requirements (strict):
- Reply with a single fenced JSON block: <json>{ ... }</json>.
- Schema: { "status": "pass" | "fail" | "unclear", "reasoning": string, "next_action_hint": string }.
- "pass" → success criteria are clearly met on the screenshot.
- "fail" → success criteria are clearly NOT met. Tell the user, in "next_action_hint", what to do next (Korean).
- "unclear" → the screenshot does not contain enough evidence either way. Use "next_action_hint" to tell the user what view to bring up.
- "reasoning" is a short Korean explanation of how you decided.
- "next_action_hint" must always be a non-empty Korean sentence (use "이대로 다음 단계로 진행하세요" when status is "pass").
- Do not output anything outside the <json>...</json> block.`;

export interface VerifyPromptInput {
  item: ChecklistItem;
  step: ChecklistStep;
}

export function buildVerifyUserPrompt({
  item,
  step,
}: VerifyPromptInput): string {
  const lines: string[] = [];
  lines.push(`# Onboarding item: ${item.title} (id=${item.id})`);
  if (item.ai_coaching?.overall_goal) {
    lines.push('');
    lines.push('## Overall goal');
    lines.push(item.ai_coaching.overall_goal.trim());
  }
  lines.push('');
  lines.push(`## Step under verification: ${step.id}`);
  lines.push('');
  lines.push('### Intent');
  lines.push(step.intent.trim());
  lines.push('');
  lines.push('### Success criteria (verify against this)');
  lines.push(step.success_criteria.trim());
  if (step.common_mistakes && step.common_mistakes.trim().length > 0) {
    lines.push('');
    lines.push('### Common mistakes the user might make');
    lines.push(step.common_mistakes.trim());
  }
  lines.push('');
  lines.push(
    'Decide pass / fail / unclear from the screenshot. Reply only with the <json>...</json> block.',
  );
  return lines.join('\n');
}
