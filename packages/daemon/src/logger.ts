import pino, { type Logger } from 'pino';

export function resolveLogLevel(): string {
  return process.env.LOG_LEVEL ?? 'info';
}

export const logger: Logger = pino({
  level: resolveLogLevel(),
  redact: {
    paths: [
      'email',
      'name',
      'phone',
      'apiKey',
      'api_key',
      'token',
      'authorization',
      '*.email',
      '*.name',
      '*.phone',
      '*.apiKey',
      '*.api_key',
      '*.token',
      '*.authorization',
    ],
    censor: '[REDACTED]',
  },
});
