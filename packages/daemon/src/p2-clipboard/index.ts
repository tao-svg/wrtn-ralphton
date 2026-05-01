import { execa } from 'execa';

export type ClipboardRunner = (text: string) => Promise<void>;

export const defaultClipboardRunner: ClipboardRunner = async (text) => {
  await execa('pbcopy', { input: text });
};

export class UnsupportedPlatformError extends Error {
  readonly code = 'unsupported_platform';
  constructor() {
    super('unsupported_platform');
    this.name = 'UnsupportedPlatformError';
  }
}

export interface CopyToClipboardOptions {
  runner?: ClipboardRunner;
  platform?: NodeJS.Platform;
}

export async function copyToClipboard(
  text: string,
  options: CopyToClipboardOptions = {},
): Promise<void> {
  const platform = options.platform ?? process.platform;
  if (platform !== 'darwin') {
    throw new UnsupportedPlatformError();
  }
  const runner = options.runner ?? defaultClipboardRunner;
  await runner(text);
}
