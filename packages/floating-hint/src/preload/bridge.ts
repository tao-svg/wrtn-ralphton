import type {
  ClipboardInput,
  ConsentInput,
  VerifyRunInput,
  VisionStepInput,
} from '../main/daemon-client.js';

export interface DaemonClientBridge {
  getChecklist: () => Promise<unknown>;
  startItem: (itemId: string) => Promise<unknown>;
  requestGuide: (input: VisionStepInput) => Promise<unknown>;
  requestVerify: (input: VisionStepInput) => Promise<unknown>;
  getRateLimit: () => Promise<unknown>;
  getConsents: () => Promise<unknown>;
  postConsent: (input: ConsentInput) => Promise<unknown>;
  postClipboard: (input: ClipboardInput) => Promise<unknown>;
  runVerify: (input: VerifyRunInput) => Promise<unknown>;
  openUrl: (url: string) => Promise<unknown>;
}
