import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { execa } from 'execa';
import sharp from 'sharp';

import {
  checkScreenRecordingPermission,
  type ScreenRecordingCheck,
} from '../system/screen-recording.js';

// PRD §7.7 F-P8-01 (`screencapture -x`), AC-VIS-07 (immediate disposal),
// §14.1 (no on-disk persistence beyond the few-second tmp window).
export const SCREENCAPTURE_TIMEOUT_MS = 5000;
// Anthropic Vision recommendation: long edge ≤ 1568 to keep token usage
// predictable.
export const MAX_LONG_EDGE = 1568;

export class ScreenRecordingDeniedError extends Error {
  readonly code = 'screen_recording_permission_required';
  constructor() {
    super('screen_recording_permission_required');
    this.name = 'ScreenRecordingDeniedError';
  }
}

export type ScreenCaptureRunner = (tmpPath: string) => Promise<void>;

export const defaultScreenCaptureRunner: ScreenCaptureRunner = async (
  tmpPath,
) => {
  await execa('screencapture', ['-x', '-t', 'png', tmpPath], {
    timeout: SCREENCAPTURE_TIMEOUT_MS,
  });
};

export type PermissionChecker = () => ScreenRecordingCheck;

export interface CaptureScreenOptions {
  runner?: ScreenCaptureRunner;
  permissionChecker?: PermissionChecker;
  maxLongEdge?: number;
}

export interface CaptureResult {
  buffer: Buffer;
  hash: string;
  width: number;
  height: number;
}

export async function captureScreen(
  options: CaptureScreenOptions = {},
): Promise<CaptureResult> {
  const checker = options.permissionChecker ?? checkScreenRecordingPermission;
  const permission = checker();
  // SPEC-013 will plug the native CGPreflightScreenCaptureAccess call in here.
  // Until then, `granted` is `null` (unknown) on darwin and we fall through to
  // screencapture itself; only an explicit `false` short-circuits with a 401.
  if (permission.granted === false) {
    throw new ScreenRecordingDeniedError();
  }

  const runner = options.runner ?? defaultScreenCaptureRunner;
  const maxLongEdge = options.maxLongEdge ?? MAX_LONG_EDGE;
  const tmpPath = join(tmpdir(), `onboarding-capture-${randomUUID()}.png`);

  try {
    await runner(tmpPath);
    const raw = await fs.readFile(tmpPath);
    return await resizeAndHash(raw, maxLongEdge);
  } finally {
    await safeUnlink(tmpPath);
  }
}

async function resizeAndHash(
  raw: Buffer,
  maxLongEdge: number,
): Promise<CaptureResult> {
  const meta = await sharp(raw).metadata();
  const srcWidth = meta.width ?? 0;
  const srcHeight = meta.height ?? 0;
  const longest = Math.max(srcWidth, srcHeight);

  let pipeline = sharp(raw);
  if (longest > maxLongEdge) {
    pipeline = pipeline.resize({
      width: maxLongEdge,
      height: maxLongEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const { data, info } = await pipeline
    .png()
    .toBuffer({ resolveWithObject: true });

  const hash = createHash('sha256').update(data).digest('hex');

  return {
    buffer: data,
    hash,
    width: info.width,
    height: info.height,
  };
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await fs.unlink(path);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return;
    }
    throw err;
  }
}
