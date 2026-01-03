import type { BridgeStatus } from "../shared/types";
import { BRIDGE_SOURCE, BRIDGE_VERSION } from "../shared/constants";
import { PAGE_MSG } from "../shared/messages";
import { createLogger } from "../shared/logger";
import { makeId } from "../shared/ids";
import {
  applyDomainEnabledUpdate,
  getCachedDomainEnabled,
  initDomainStatusCache,
  setDomainStatus,
  type DomainStatusCache
} from "../shared/domainCache";

const log = createLogger("page-status");
const domainStatusCache = initDomainStatusCache();
let domainStatusPromise: Promise<BridgeStatus> | null = null;

export function getDomainStatusCache(): DomainStatusCache {
  return domainStatusCache;
}

export function getCachedDomainEnabledValue(): boolean | null {
  return getCachedDomainEnabled(domainStatusCache);
}

export function applyDomainUpdate(payload: { enabled?: boolean; source?: string }): void {
  applyDomainEnabledUpdate(domainStatusCache, payload);
}

async function fetchDomainStatus(): Promise<BridgeStatus> {
  if (domainStatusPromise) return domainStatusPromise;

  domainStatusPromise = new Promise<BridgeStatus>((resolve) => {
    const statusId = makeId("status");
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      const fallback: BridgeStatus = {
        installed: true,
        version: BRIDGE_VERSION,
        domainEnabled: false,
        domainSource: "default",
        originAllowed: true,
        hasApiKeys: false,
        ready: false,
        reason: "Timeout waiting for status"
      };
      setDomainStatus(domainStatusCache, fallback);
      resolve(fallback);
    }, 3000);

    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const data = ev.data as { source?: string; type?: string; payload?: { statusId: string; status: BridgeStatus } };
      if (!data || data.source !== BRIDGE_SOURCE) return;
      if (data.type !== PAGE_MSG.STATUS_RESPONSE) return;
      if (data.payload?.statusId !== statusId) return;

      clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      setDomainStatus(domainStatusCache, data.payload.status);
      resolve(data.payload.status);
    };

    window.addEventListener("message", onMessage);
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.STATUS_REQUEST,
      payload: { statusId }
    }, "*");
  });

  const result = await domainStatusPromise;
  domainStatusPromise = null;
  return result;
}

export async function ensureDomainStatus(): Promise<BridgeStatus> {
  const status = await fetchDomainStatus();
  return status;
}

export async function ensureDomainEnabled(): Promise<boolean> {
  let enabled = getCachedDomainEnabled(domainStatusCache);
  if (enabled === null) {
    try {
      await ensureDomainStatus();
      enabled = getCachedDomainEnabled(domainStatusCache);
    } catch (e) {
      log.warn("Failed to ensure domain status", e);
      enabled = null;
    }
  }
  return enabled === true;
}
