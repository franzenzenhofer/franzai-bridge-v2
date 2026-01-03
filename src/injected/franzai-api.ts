import type { BridgeStatus } from "../shared/types";
import { BRIDGE_SOURCE, BRIDGE_VERSION } from "../shared/constants";
import { PAGE_MSG } from "../shared/messages";
import { makeId } from "../shared/ids";
import { createBridgeFetch } from "./bridge-fetch";
import { createGoogleApi } from "./google/api";
import { normalizeMode } from "./config";
import { ensureDomainStatus } from "./domain-status";
import type { BridgeConfig, BridgeInit, FranzAIBridge } from "./types";
import type { LiteRequest } from "./types";

export type FranzaiDeps = {
  bridgeConfig: BridgeConfig;
  ensureDomainEnabled: () => Promise<boolean>;
  requestToLite: (input: RequestInfo | URL, init?: BridgeInit) => Promise<LiteRequest>;
};

export function createFranzaiBridge(deps: FranzaiDeps): FranzAIBridge {
  const bridgeFetch = createBridgeFetch({
    ensureDomainEnabled: deps.ensureDomainEnabled,
    requestToLite: deps.requestToLite
  });

  const franzai: FranzAIBridge = {
    version: BRIDGE_VERSION,
    keys: [],

    async ping() {
      return { ok: true as const, version: franzai.version };
    },

    setMode(mode) {
      deps.bridgeConfig.mode = normalizeMode(mode) ?? "auto";
      return deps.bridgeConfig.mode;
    },

    getMode() {
      return deps.bridgeConfig.mode ?? "auto";
    },

    async isKeySet(keyName: string): Promise<boolean> {
      if (!keyName || typeof keyName !== "string") return false;

      const checkId = makeId("keycheck");

      return new Promise<boolean>((resolve) => {
        const timeoutId = window.setTimeout(() => {
          window.removeEventListener("message", onMessage);
          resolve(false);
        }, 5000);

        const onMessage = (ev: MessageEvent) => {
          if (ev.source !== window) return;
          const data = ev.data as { source?: string; type?: string; payload?: { checkId: string; isSet: boolean } };
          if (!data || data.source !== BRIDGE_SOURCE) return;
          if (data.type !== PAGE_MSG.KEY_CHECK_RESPONSE) return;
          if (data.payload?.checkId !== checkId) return;

          clearTimeout(timeoutId);
          window.removeEventListener("message", onMessage);
          resolve(data.payload.isSet);
        };

        window.addEventListener("message", onMessage);
        window.postMessage({
          source: BRIDGE_SOURCE,
          type: PAGE_MSG.KEY_CHECK_REQUEST,
          payload: { checkId, keyName }
        }, "*");
      });
    },

    async hasApiKey(keyName: string): Promise<boolean> {
      return franzai.isKeySet(keyName);
    },

    async getStatus(): Promise<BridgeStatus> {
      return ensureDomainStatus();
    },

    fetch: bridgeFetch,
    google: createGoogleApi(deps.ensureDomainEnabled)
  };

  return franzai;
}
