export interface HighlightRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const VISION_CONFIDENCES = ['low', 'medium', 'high'] as const;
export type VisionConfidence = (typeof VISION_CONFIDENCES)[number];

export interface VisionGuideResult {
  type: 'guide';
  message: string;
  highlight_region?: HighlightRegion;
  confidence: VisionConfidence;
}

export const VISION_VERIFY_STATUSES = ['pass', 'fail', 'unclear'] as const;
export type VisionVerifyStatus = (typeof VISION_VERIFY_STATUSES)[number];

export interface VisionVerifyResult {
  type: 'verify';
  status: VisionVerifyStatus;
  reasoning: string;
  next_action_hint?: string;
}
