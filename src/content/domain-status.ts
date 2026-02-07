import type { BridgeStatus } from "../shared/types";
import { BG_MSG, PAGE_MSG } from "../shared/messages";
import { BRIDGE_SOURCE } from "../shared/constants";
import { createLogger } from "../shared/logger";
import { sendRuntimeMessage } from "../shared/runtime";
import { resolveCurrentDomain } from "./domain";

const log = createLogger("content-status");

let domainStatusCache: BridgeStatus | null = null;
let domainStatusPromise: Promise<BridgeStatus> | null = null;

export function getDomainStatusCache(): BridgeStatus | null {
  return domainStatusCache;
}

export function setDomainStatusCache(status: BridgeStatus): void {
  domainStatusCache = status;
}

export function makeFallbackStatus(reason: string): BridgeStatus {
  return {
    installed: true,
    version: "unknown",
    domainEnabled: false,
    domainSource: "default",
    originAllowed: false,
    hasApiKeys: false,
    ready: false,
    reason
  };
}

export async function fetchDomainStatus(domain: string): Promise<BridgeStatus> {
  if (domainStatusPromise) return domainStatusPromise;

  domainStatusPromise = (async () => {
    try {
      const resp = await sendRuntimeMessage<
        { type: typeof BG_MSG.GET_DOMAIN_STATUS; payload: { domain: string } },
        { ok: boolean; status: BridgeStatus; error?: string }
      >({
        type: BG_MSG.GET_DOMAIN_STATUS,
        payload: { domain }
      });

      const status = resp.ok && resp.status
        ? resp.status
        : makeFallbackStatus(resp.error ?? "Failed to get status from extension");
      domainStatusCache = status;
      return status;
    } catch (e) {
      log.warn("Failed to fetch domain status", e);
      const fallback = makeFallbackStatus("Failed to get status from extension");
      domainStatusCache = fallback;
      return fallback;
    } finally {
      domainStatusPromise = null;
    }
  })();

  return domainStatusPromise;
}

export function isBridgeEnabled(status: BridgeStatus | null): boolean {
  return status?.domainEnabled === true;
}

export function sendDomainEnabledUpdate(enabled: boolean, source: string): void {
  window.postMessage({
    source: BRIDGE_SOURCE,
    type: PAGE_MSG.DOMAIN_ENABLED_UPDATE,
    payload: { enabled, source }
  }, "*");
}

export async function sendInitialDomainStatus(): Promise<void> {
  const domain = resolveCurrentDomain();
  if (!domain) {
    sendDomainEnabledUpdate(false, "default");
    return;
  }
  const status = await fetchDomainStatus(domain);
  sendDomainEnabledUpdate(status.domainEnabled, status.domainSource);
}
