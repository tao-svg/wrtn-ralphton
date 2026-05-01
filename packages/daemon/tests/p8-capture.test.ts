import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';

import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import {
  captureScreen,
  defaultScreenCaptureRunner,
  MAX_LONG_EDGE,
  SCREENCAPTURE_TIMEOUT_MS,
  ScreenRecordingDeniedError,
  type ScreenCaptureRunner,
} from '../src/p8-vision/capture.js';
import { disposeBuffer } from '../src/p8-vision/dispose.js';

async function makePngBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
}

function makeRunner(rawPng: Buffer): ScreenCaptureRunner {
  return async (tmpPath: string) => {
    await fs.writeFile(tmpPath, rawPng);
  };
}

async function listLeftoverCaptures(): Promise<string[]> {
  const entries = await fs.readdir(tmpdir());
  return entries.filter(
    (name) => name.startsWith('onboarding-capture-') && name.endsWith('.png'),
  );
}

describe('disposeBuffer (p8-vision/dispose.ts)', () => {
  it('overwrites every byte with zero', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    disposeBuffer(buf);
    for (const byte of buf) {
      expect(byte).toBe(0);
    }
  });

  it('handles empty buffer without throwing', () => {
    const buf = Buffer.alloc(0);
    expect(() => disposeBuffer(buf)).not.toThrow();
  });

  it('zeroes a large buffer entirely', () => {
    const size = 1024 * 64;
    const buf = Buffer.alloc(size, 0xff);
    expect(buf[0]).toBe(0xff);
    expect(buf[size - 1]).toBe(0xff);
    disposeBuffer(buf);
    expect(buf.every((b) => b === 0)).toBe(true);
  });
});

describe('captureScreen — permission gate (AC)', () => {
  it('throws ScreenRecordingDeniedError when permissionChecker reports granted=false', async () => {
    const runner = vi.fn() as unknown as ScreenCaptureRunner;
    await expect(
      captureScreen({
        runner,
        permissionChecker: () => ({ supported: true, granted: false }),
      }),
    ).rejects.toBeInstanceOf(ScreenRecordingDeniedError);
    expect(runner).not.toHaveBeenCalled();
  });

  it('ScreenRecordingDeniedError exposes code "screen_recording_permission_required"', () => {
    const err = new ScreenRecordingDeniedError();
    expect(err.code).toBe('screen_recording_permission_required');
    expect(err.message).toBe('screen_recording_permission_required');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ScreenRecordingDeniedError');
  });

  it('proceeds when permissionChecker reports granted=true', async () => {
    const png = await makePngBuffer(120, 90);
    const runner = vi.fn(makeRunner(png));
    const result = await captureScreen({
      runner,
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  it('proceeds when permissionChecker reports granted=null (unknown until SPEC-013 wires native check)', async () => {
    const png = await makePngBuffer(120, 90);
    const runner = vi.fn(makeRunner(png));
    const result = await captureScreen({
      runner,
      permissionChecker: () => ({ supported: true, granted: null }),
    });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });
});

describe('captureScreen — return shape', () => {
  it('returns buffer, hash, width, height', async () => {
    const png = await makePngBuffer(640, 480);
    const result = await captureScreen({
      runner: makeRunner(png),
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(typeof result.hash).toBe('string');
    expect(typeof result.width).toBe('number');
    expect(typeof result.height).toBe('number');
  });

  it('hash is hex64 SHA256 (used as cache key)', async () => {
    const png = await makePngBuffer(640, 480);
    const result = await captureScreen({
      runner: makeRunner(png),
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash is deterministic for the same input bytes', async () => {
    const png = await makePngBuffer(320, 240);
    const a = await captureScreen({
      runner: makeRunner(png),
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    const b = await captureScreen({
      runner: makeRunner(png),
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    expect(a.hash).toBe(b.hash);
  });

  it('hash differs when input differs', async () => {
    const a = await captureScreen({
      runner: makeRunner(await makePngBuffer(320, 240)),
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    const b = await captureScreen({
      runner: makeRunner(await makePngBuffer(640, 480)),
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('captureScreen — sharp resize to long-edge ≤ 1568px (AC)', () => {
  it('downscales 4096×2160 (Retina-class) to long-edge ≤ 1568', async () => {
    const png = await makePngBuffer(4096, 2160);
    const result = await captureScreen({
      runner: makeRunner(png),
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(MAX_LONG_EDGE);
    // Aspect ratio should be preserved (long edge should hit cap exactly)
    expect(Math.max(result.width, result.height)).toBe(MAX_LONG_EDGE);
  });

  it('downscales tall portrait input on the long edge', async () => {
    const png = await makePngBuffer(1080, 4000);
    const result = await captureScreen({
      runner: makeRunner(png),
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(MAX_LONG_EDGE);
    expect(result.height).toBe(MAX_LONG_EDGE);
  });

  it('does not enlarge images already smaller than 1568px', async () => {
    const png = await makePngBuffer(640, 480);
    const result = await captureScreen({
      runner: makeRunner(png),
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
  });

  it('keeps an image at the exact 1568px boundary unchanged', async () => {
    const png = await makePngBuffer(1568, 1000);
    const result = await captureScreen({
      runner: makeRunner(png),
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    expect(result.width).toBe(1568);
    expect(result.height).toBe(1000);
  });

  it('respects override maxLongEdge option', async () => {
    const png = await makePngBuffer(2000, 1500);
    const result = await captureScreen({
      runner: makeRunner(png),
      permissionChecker: () => ({ supported: true, granted: true }),
      maxLongEdge: 800,
    });
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(800);
    expect(result.width).toBe(800);
  });
});

describe('captureScreen — AC-VIS-07 immediate disposal of tmp file', () => {
  it('unlinks the tmp PNG before returning (zero leftovers)', async () => {
    const before = await listLeftoverCaptures();
    const png = await makePngBuffer(320, 240);
    await captureScreen({
      runner: makeRunner(png),
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    const after = await listLeftoverCaptures();
    expect(after.length).toBe(before.length);
  });

  it('reports the tmp path matches onboarding-capture-<uuid>.png pattern', async () => {
    const observed: string[] = [];
    const png = await makePngBuffer(320, 240);
    const runner: ScreenCaptureRunner = async (tmpPath) => {
      observed.push(tmpPath);
      await fs.writeFile(tmpPath, png);
    };
    await captureScreen({
      runner,
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    expect(observed).toHaveLength(1);
    const observedPath = observed[0]!;
    expect(observedPath.startsWith(tmpdir())).toBe(true);
    const filename = observedPath.slice(tmpdir().length + 1);
    expect(filename).toMatch(
      /^onboarding-capture-[0-9a-f-]{36}\.png$/,
    );
  });

  it('the tmp file no longer exists after captureScreen resolves (fs.access ENOENT)', async () => {
    const observed: string[] = [];
    const png = await makePngBuffer(320, 240);
    const runner: ScreenCaptureRunner = async (tmpPath) => {
      observed.push(tmpPath);
      await fs.writeFile(tmpPath, png);
    };
    await captureScreen({
      runner,
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    const tmpPath = observed[0]!;
    await expect(fs.access(tmpPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('still unlinks the tmp file when the runner throws', async () => {
    const observed: string[] = [];
    const runner: ScreenCaptureRunner = async (tmpPath) => {
      observed.push(tmpPath);
      // Touch the file then fail, to mimic a partial capture leaving bytes on disk
      await fs.writeFile(tmpPath, Buffer.from([0x00]));
      throw new Error('runner exploded');
    };
    await expect(
      captureScreen({
        runner,
        permissionChecker: () => ({ supported: true, granted: true }),
      }),
    ).rejects.toThrow('runner exploded');
    const tmpPath = observed[0]!;
    await expect(fs.access(tmpPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not throw if the runner never created the tmp file (ENOENT swallowed)', async () => {
    const runner: ScreenCaptureRunner = async () => {
      // intentionally do nothing — no file produced
    };
    // captureScreen should fail because there is no file to read, but the
    // unlink() call inside finally must not raise its own ENOENT.
    await expect(
      captureScreen({
        runner,
        permissionChecker: () => ({ supported: true, granted: true }),
      }),
    ).rejects.toThrow();
  });

  it('uses a unique tmp path per call', async () => {
    const observed: string[] = [];
    const png = await makePngBuffer(64, 64);
    const runner: ScreenCaptureRunner = async (tmpPath) => {
      observed.push(tmpPath);
      await fs.writeFile(tmpPath, png);
    };
    await captureScreen({
      runner,
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    await captureScreen({
      runner,
      permissionChecker: () => ({ supported: true, granted: true }),
    });
    expect(observed).toHaveLength(2);
    expect(observed[0]).not.toBe(observed[1]);
  });
});

describe('captureScreen — defaults', () => {
  it('exposes a 5-second timeout constant for screencapture', () => {
    expect(SCREENCAPTURE_TIMEOUT_MS).toBe(5000);
  });

  it('exposes the long-edge cap of 1568px (Anthropic Vision recommendation)', () => {
    expect(MAX_LONG_EDGE).toBe(1568);
  });

  it('defaultScreenCaptureRunner is a function', () => {
    expect(typeof defaultScreenCaptureRunner).toBe('function');
  });
});

describe('captureScreen — real macOS screencapture (smoke test)', () => {
  it('captures the live screen on darwin (skipped elsewhere; integration smoke)', async () => {
    if (process.platform !== 'darwin') {
      return;
    }
    if (process.env.CI === 'true' || process.env.CI === '1') {
      // CI does not have screen-recording permission and would block on a
      // permission dialog; integration smoke runs locally only.
      return;
    }
    const before = await listLeftoverCaptures();
    let result;
    try {
      result = await captureScreen();
    } catch (err) {
      // If the dev box has not granted screen recording permission, the
      // captured PNG may be empty / malformed. We accept that path for the
      // smoke test — what matters is that nothing leaks to disk.
      const after = await listLeftoverCaptures();
      expect(after.length).toBe(before.length);
      return;
    }
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(MAX_LONG_EDGE);

    const after = await listLeftoverCaptures();
    expect(after.length).toBe(before.length);
  }, 15_000);
});

describe('directory layout', () => {
  it('co-locates capture.ts and dispose.ts under p8-vision/', async () => {
    const here = new URL('../src/p8-vision/', import.meta.url);
    const entries = await fs.readdir(here);
    expect(entries).toContain('capture.ts');
    expect(entries).toContain('dispose.ts');
  });

  it('p8-vision/capture.ts path resolves against the spec\'s package layout', () => {
    const captureUrl = new URL('../src/p8-vision/capture.ts', import.meta.url).pathname;
    expect(captureUrl).toMatch(/packages\/daemon\/src\/p8-vision\/capture\.ts$/);
    const disposeUrl = new URL('../src/p8-vision/dispose.ts', import.meta.url).pathname;
    expect(disposeUrl).toMatch(/packages\/daemon\/src\/p8-vision\/dispose\.ts$/);
  });
});
