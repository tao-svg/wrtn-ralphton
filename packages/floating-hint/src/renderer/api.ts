import type { DaemonClientBridge } from '../preload/bridge.js';
import type {
  ChecklistResponse,
  OverlayClient,
  RendererApi,
  VisionGuideResponse,
  VisionVerifyResponse,
} from './state/store.js';
import type { RateLimitInfo } from './state/machine.js';

export interface CreateRendererApiOptions {
  bridge?: DaemonClientBridge;
}

function resolveBridge(
  override: DaemonClientBridge | undefined,
): DaemonClientBridge {
  if (override) return override;
  const global = globalThis as { daemonClient?: DaemonClientBridge };
  if (!global.daemonClient) {
    throw new Error(
      'daemonClient bridge is not exposed on the window. Make sure preload/index.ts ran.',
    );
  }
  return global.daemonClient;
}

export function createRendererApi(
  options: CreateRendererApiOptions = {},
): RendererApi {
  const bridge = resolveBridge(options.bridge);
  return {
    getChecklist: () =>
      bridge.getChecklist() as Promise<ChecklistResponse>,
    requestGuide: (input) =>
      bridge.requestGuide(input) as Promise<VisionGuideResponse>,
    requestVerify: (input) =>
      bridge.requestVerify(input) as Promise<VisionVerifyResponse>,
    getRateLimit: () => bridge.getRateLimit() as Promise<RateLimitInfo>,
    getConsents: () => bridge.getConsents(),
  };
}

export function resolveOverlayClient(): OverlayClient | undefined {
  const global = globalThis as { overlayController?: OverlayClient };
  return global.overlayController;
}
