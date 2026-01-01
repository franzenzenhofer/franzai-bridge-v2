import type { BridgeStatus } from "./types";

export type DomainStatusCache = {
  status: BridgeStatus | null;
  enabledOverride: boolean | null;
};

export function initDomainStatusCache(): DomainStatusCache {
  return {
    status: null,
    enabledOverride: null
  };
}

export function getCachedDomainEnabled(cache: DomainStatusCache): boolean | null {
  if (cache.enabledOverride !== null) return cache.enabledOverride;
  return cache.status?.domainEnabled ?? null;
}

export function setDomainStatus(cache: DomainStatusCache, status: BridgeStatus): void {
  cache.status = status;
  cache.enabledOverride = null;
}

export function applyDomainEnabledUpdate(
  cache: DomainStatusCache,
  payload: { enabled?: boolean; source?: string }
): void {
  const enabled = payload.enabled ?? false;

  if (cache.status) {
    cache.status.domainEnabled = enabled;
    const source = payload.source;
    if (source === "user" || source === "meta" || source === "default") {
      cache.status.domainSource = source;
    } else {
      cache.status.domainSource = "default";
    }
    cache.enabledOverride = null;
    return;
  }

  cache.enabledOverride = enabled;
}
