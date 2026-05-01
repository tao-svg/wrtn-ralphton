import { contextBridge } from 'electron';
import {
  createDaemonClient,
  type ClipboardInput,
  type ConsentInput,
  type DaemonClient,
  type VerifyRunInput,
  type VisionStepInput,
} from '../main/daemon-client.js';
import type { DaemonClientBridge } from './bridge.js';

export type { DaemonClientBridge } from './bridge.js';

const client: DaemonClient = createDaemonClient();

const exposed: DaemonClientBridge = {
  getChecklist: () => client.getChecklist(),
  startItem: (itemId: string) => client.startItem(itemId),
  requestGuide: (input: VisionStepInput) => client.requestGuide(input),
  requestVerify: (input: VisionStepInput) => client.requestVerify(input),
  getRateLimit: () => client.getRateLimit(),
  getConsents: () => client.getConsents(),
  postConsent: (input: ConsentInput) => client.postConsent(input),
  postClipboard: (input: ClipboardInput) => client.postClipboard(input),
  runVerify: (input: VerifyRunInput) => client.runVerify(input),
};

contextBridge.exposeInMainWorld('daemonClient', exposed);
