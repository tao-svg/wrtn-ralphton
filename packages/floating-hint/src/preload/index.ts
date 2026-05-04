import { contextBridge, ipcRenderer } from 'electron';
import type { HighlightRegion } from '@onboarding/shared';
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
  openUrl: (url: string) => ipcRenderer.invoke('open-url', url),
};

contextBridge.exposeInMainWorld('daemonClient', exposed);

export interface OverlayController {
  show(region: HighlightRegion): void;
  hide(): void;
}

const overlayController: OverlayController = {
  show: (region) => ipcRenderer.send('overlay:show', region),
  hide: () => ipcRenderer.send('overlay:hide'),
};

contextBridge.exposeInMainWorld('overlayController', overlayController);
