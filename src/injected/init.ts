import { BRIDGE_SOURCE, BRIDGE_VERSION } from "../shared/constants";
import { PAGE_MSG } from "../shared/messages";
import { createLogger } from "../shared/logger";
import type { CaptureState } from "./capture";
import { getBridgeConfig } from "./config";
import { registerBridgeEventListeners } from "./bridge-events";
import { createFranzaiBridge } from "./franzai-api";
import { createHookManager } from "./hooks";
import { createHookedFetch } from "./hooked-fetch";
import { createHookedWebSocket } from "./hooked-websocket";
import { ensureDomainEnabled, ensureDomainStatus, getCachedDomainEnabledValue } from "./domain-status";
import { requestToLite } from "./request";
import { setRequestMode } from "./request-meta";
import { modeFromInit } from "./mode";
import { refreshKeyNames } from "./keys";

const log = createLogger("page");

export function initBridge(capture: CaptureState): void {
  const bridgeConfig = getBridgeConfig();
  const hookState = { installed: false };

  const franzai = createFranzaiBridge({
    bridgeConfig,
    ensureDomainEnabled,
    requestToLite
  });

  const hookedFetch = createHookedFetch({
    nativeFetch: capture.nativeFetch,
    bridgeFetch: franzai.fetch,
    bridgeConfig,
    hookState
  });
  const hookedWebSocket = createHookedWebSocket(capture.nativeWebSocket, bridgeConfig);

  const hookManager = createHookManager({
    nativeFetch: capture.nativeFetch,
    nativeRequest: capture.nativeRequest,
    nativeWebSocket: capture.nativeWebSocket,
    nativeFetchDescriptor: capture.nativeFetchDescriptor,
    nativeRequestDescriptor: capture.nativeRequestDescriptor,
    nativeWebSocketDescriptor: capture.nativeWebSocketDescriptor,
    bridgeConfig,
    hookedFetch,
    hookedWebSocket,
    hookState,
    setRequestMode,
    modeFromInit,
    getDomainEnabled: getCachedDomainEnabledValue,
    onBridgeReady: () => {
      window.postMessage({
        source: BRIDGE_SOURCE,
        type: PAGE_MSG.BRIDGE_READY,
        payload: { version: BRIDGE_VERSION }
      }, "*");
    }
  });

  registerBridgeEventListeners(hookManager.syncBridgeHooksFromCache);

  if (!capture.alreadyInstalled) {
    Object.defineProperty(capture.win, "franzai", {
      value: franzai,
      writable: false,
      configurable: false,
      enumerable: true
    });

    log.info("FranzAI Bridge installed", {
      version: franzai.version,
      mode: bridgeConfig.mode,
      locked: bridgeConfig.lockHooks
    });

    refreshKeyNames().catch(() => {
      // Ignore refresh failures; keys can be requested later.
    });

    franzai.google.getState().catch(() => {
      // Ignore refresh failures; state can be requested later.
    });

    ensureDomainStatus().then(() => {
      hookManager.syncBridgeHooksFromCache();
    }).catch(() => {
      // Ignore status failures; hooks remain off by default.
    });
  }
}
