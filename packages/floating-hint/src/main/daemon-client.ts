export const DEFAULT_DAEMON_BASE_URL = 'http://localhost:7777';

export interface DaemonClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface VisionStepInput {
  item_id: string;
  step_id: string;
}

export interface ConsentInput {
  consent_type: string;
  granted: boolean;
}

export interface ClipboardInput {
  command: string;
}

export interface VerifyRunInput {
  item_id: string;
  verification: unknown;
}

export interface DaemonClient {
  getChecklist(): Promise<unknown>;
  startItem(itemId: string): Promise<unknown>;
  requestGuide(input: VisionStepInput): Promise<unknown>;
  requestVerify(input: VisionStepInput): Promise<unknown>;
  getRateLimit(): Promise<unknown>;
  getConsents(): Promise<unknown>;
  postConsent(input: ConsentInput): Promise<unknown>;
  postClipboard(input: ClipboardInput): Promise<unknown>;
  runVerify(input: VerifyRunInput): Promise<unknown>;
}

export class DaemonHttpError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`Daemon HTTP error ${status}`);
    this.name = 'DaemonHttpError';
    this.status = status;
    this.body = body;
  }
}

export function createDaemonClient(options: DaemonClientOptions = {}): DaemonClient {
  const baseUrl = options.baseUrl ?? DEFAULT_DAEMON_BASE_URL;
  const fetchImpl: typeof fetch =
    options.fetchImpl ?? ((...args) => globalThis.fetch(...args));

  async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const res = await fetchImpl(`${baseUrl}${path}`, init);
    if (!res.ok) {
      let errBody: unknown = undefined;
      try {
        errBody = await res.json();
      } catch {
        errBody = undefined;
      }
      throw new DaemonHttpError(res.status, errBody);
    }
    return (await res.json()) as T;
  }

  return {
    getChecklist: () => request('GET', '/api/checklist'),
    startItem: (itemId) =>
      request('POST', `/api/items/${encodeURIComponent(itemId)}/start`),
    requestGuide: (input) => request('POST', '/api/vision/guide', input),
    requestVerify: (input) => request('POST', '/api/vision/verify', input),
    getRateLimit: () => request('GET', '/api/vision/rate-limit'),
    getConsents: () => request('GET', '/api/consents'),
    postConsent: (input) => request('POST', '/api/consents', input),
    postClipboard: (input) => request('POST', '/api/clipboard', input),
    runVerify: (input) => request('POST', '/api/verify/run', input),
  };
}
