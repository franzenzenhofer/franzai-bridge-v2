import { createLogger } from "../shared/logger";
import { isAbortError } from "./errors";
import { resolveBridgeMode } from "./mode";
import { ensureDomainStatus, getCachedDomainEnabledValue } from "./domain-status";
import type { BridgeConfig, BridgeInit } from "./types";

const log = createLogger("page");

type HookedFetchDeps = {
  nativeFetch: typeof fetch;
  bridgeFetch: (input: RequestInfo | URL, init?: BridgeInit) => Promise<Response>;
  bridgeConfig: BridgeConfig;
  hookState: { installed: boolean };
};

function isCrossOrigin(input: RequestInfo | URL): boolean {
  try {
    const url = new URL(typeof input === "string" ? input : input.toString(), window.location.href);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function shouldUseBridgeForRequest(input: RequestInfo | URL, init?: BridgeInit, mode?: BridgeConfig["mode"]): boolean {
  const resolvedMode = resolveBridgeMode(input, init, mode ?? "always");
  if (resolvedMode === "off") return false;
  if (resolvedMode === "always") return true;
  return isCrossOrigin(input);
}

export function createHookedFetch(deps: HookedFetchDeps): typeof fetch {
  return async (input: RequestInfo | URL, init?: BridgeInit): Promise<Response> => {
    if (!deps.hookState.installed) {
      return deps.nativeFetch(input as RequestInfo, init as RequestInit | undefined);
    }

    const mode = resolveBridgeMode(input, init, deps.bridgeConfig.mode ?? "always");
    if (!shouldUseBridgeForRequest(input, init, mode)) {
      return deps.nativeFetch(input as RequestInfo, init as RequestInit | undefined);
    }

    let domainEnabled = getCachedDomainEnabledValue();
    log.info("hookedFetch check - cachedEnabled:", domainEnabled);

    if (domainEnabled === null) {
      try {
        await ensureDomainStatus();
        domainEnabled = getCachedDomainEnabledValue();
        log.info("hookedFetch after fetch - domainEnabled:", domainEnabled);
      } catch {
        log.info("Domain status fetch failed, using nativeFetch");
        return deps.nativeFetch(input as RequestInfo, init as RequestInit | undefined);
      }
    }

    if (domainEnabled !== true) {
      log.info("Domain not enabled, using nativeFetch");
      return deps.nativeFetch(input as RequestInfo, init as RequestInit | undefined);
    }

    try {
      return await deps.bridgeFetch(input, init);
    } catch (e) {
      if (isAbortError(e)) throw e;
      if (mode === "always") throw e;

      const msg = e instanceof Error ? e.message : String(e);
      log.debug("Bridge fetch failed, falling back to native fetch", msg);

      try {
        return await deps.nativeFetch(input as RequestInfo, init as RequestInit | undefined);
      } catch {
        throw new Error(msg);
      }
    }
  };
}
