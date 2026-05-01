export interface ChecklistInput {
  key: string;
  label: string;
  required: boolean;
}

export interface ClipboardInject {
  command: string;
  ui_hint?: string;
}

export interface CommandVerification {
  type: 'command';
  command: string;
  expect_contains?: string;
  poll_interval_sec?: number;
}

export interface ProcessCheckVerification {
  type: 'process_check';
  process_name: string;
  poll_interval_sec?: number;
}

export type Verification = CommandVerification | ProcessCheckVerification;

export interface ChecklistStep {
  id: string;
  intent: string;
  success_criteria: string;
  system_panel_url?: string;
  common_mistakes?: string;
}

export interface AiCoaching {
  overall_goal: string;
  steps: ChecklistStep[];
}

export interface Template {
  content: string;
  paste_target: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  estimated_minutes: number;
  inputs?: ChecklistInput[];
  clipboard_inject?: ClipboardInject;
  ai_coaching?: AiCoaching;
  template?: Template;
  verification?: Verification;
  system_panel_url?: string;
}

export interface ChecklistFile {
  version: number;
  schema: string;
  items: ChecklistItem[];
}
