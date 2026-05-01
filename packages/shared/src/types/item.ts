export type ItemId = string;

export const ITEM_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'blocked',
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export interface ItemState {
  item_id: ItemId;
  status: ItemStatus;
  current_step: string | null;
  started_at: number | null;
  completed_at: number | null;
  attempt_count: number;
}
