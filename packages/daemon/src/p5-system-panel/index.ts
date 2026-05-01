import { execa } from 'execa';

export type SystemPanelRunner = (url: string) => Promise<void>;

export const defaultSystemPanelRunner: SystemPanelRunner = async (url) => {
  await execa('open', [url]);
};

export const ALLOWED_URL_PREFIXES = [
  'x-apple.systempreferences:',
  'https://',
  'file://',
] as const;

export class UnsupportedPlatformError extends Error {
  readonly code = 'unsupported_platform';
  constructor() {
    super('unsupported_platform');
    this.name = 'UnsupportedPlatformError';
  }
}

export class InvalidPanelUrlError extends Error {
  readonly code = 'invalid_panel_url';
  constructor(public readonly url: string) {
    super(`invalid_panel_url: ${url}`);
    this.name = 'InvalidPanelUrlError';
  }
}

export interface LaunchSystemPanelOptions {
  runner?: SystemPanelRunner;
  platform?: NodeJS.Platform;
}

export function isAllowedPanelUrl(url: string): boolean {
  return ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export async function launchSystemPanel(
  url: string,
  options: LaunchSystemPanelOptions = {},
): Promise<void> {
  if (!isAllowedPanelUrl(url)) {
    throw new InvalidPanelUrlError(url);
  }
  const platform = options.platform ?? process.platform;
  if (platform !== 'darwin') {
    throw new UnsupportedPlatformError();
  }
  const runner = options.runner ?? defaultSystemPanelRunner;
  await runner(url);
}
