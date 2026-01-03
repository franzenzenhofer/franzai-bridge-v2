import type { BridgeConfig, BridgeMode } from "./types";
export type HookManager = {
  installBridgeHooks: () => void;
  uninstallBridgeHooks: () => void;
  syncBridgeHooksFromCache: () => void;
  setBridgeActive: (active: boolean) => void;
  hookState: { installed: boolean };
};
type HookArgs = {
  nativeFetch: typeof fetch;
  nativeRequest: typeof Request;
  nativeFetchDescriptor: PropertyDescriptor | null;
  nativeRequestDescriptor: PropertyDescriptor | null;
  bridgeConfig: BridgeConfig;
  hookedFetch: typeof fetch;
  hookState: { installed: boolean };
  setRequestMode: (request: Request, mode?: BridgeMode) => void;
  modeFromInit: (init?: RequestInit) => BridgeMode | undefined;
  getDomainEnabled: () => boolean | null;
  onBridgeReady: () => void;
};
function restoreNativeFetch(nativeFetch: typeof fetch, originalDescriptor: PropertyDescriptor | null) {
  if (originalDescriptor) {
    try {
      Object.defineProperty(window, "fetch", originalDescriptor);
      return;
    } catch {
      // Fall back to assignment/delete below.
    }
  }
  try {
    delete (window as { fetch?: typeof fetch }).fetch;
  } catch {
    // Ignore delete errors; fall back to assignment.
  }
  try {
    window.fetch = nativeFetch as typeof fetch;
  } catch {
    // Ignore restore failures.
  }
}
function restoreNativeRequest(nativeRequest: typeof Request, originalDescriptor: PropertyDescriptor | null) {
  if (originalDescriptor) {
    try {
      Object.defineProperty(window, "Request", originalDescriptor);
      return;
    } catch {
      // Fall back to assignment/delete below.
    }
  }
  try {
    delete (window as { Request?: typeof Request }).Request;
  } catch {
    // Ignore delete errors; fall back to assignment.
  }
  try {
    window.Request = nativeRequest;
  } catch {
    // Ignore restore failures.
  }
}
function installFetchHook(hookedFetch: typeof fetch, bridgeConfig: BridgeConfig) {
  const hookDescriptor: PropertyDescriptor = {
    value: hookedFetch,
    enumerable: true,
    writable: !bridgeConfig.lockHooks,
    configurable: true
  };

  try {
    Object.defineProperty(window, "fetch", hookDescriptor);
  } catch {
    window.fetch = hookedFetch as typeof fetch;
  }
  if (!bridgeConfig.lockHooks) return;

  queueMicrotask(() => {
    if (window.fetch !== hookedFetch) {
      try {
        Object.defineProperty(window, "fetch", hookDescriptor);
      } catch {
        // Ignore recovery failures.
      }
    }
  });
}

function installRequestHook(nativeRequest: typeof Request, setRequestMode: HookArgs["setRequestMode"], modeFromInit: HookArgs["modeFromInit"]) {
  const w = window as unknown as { __franzaiRequestHookInstalled?: boolean };
  if (w.__franzaiRequestHookInstalled) return;
  w.__franzaiRequestHookInstalled = true;

  const FranzaiRequest = function (input: RequestInfo | URL, init?: RequestInit): Request {
    const req = new nativeRequest(input, init);
    setRequestMode(req, modeFromInit(init));
    return req;
  } as unknown as typeof Request;

  FranzaiRequest.prototype = nativeRequest.prototype;
  Object.setPrototypeOf(FranzaiRequest, nativeRequest);

  try {
    Object.defineProperty(window, "Request", {
      configurable: true,
      writable: true,
      value: FranzaiRequest
    });
  } catch {
    window.Request = FranzaiRequest;
  }
}

export function createHookManager(args: HookArgs): HookManager {
  const hookState = args.hookState;

  const installBridgeHooks = () => {
    if (hookState.installed) return;
    installRequestHook(args.nativeRequest, args.setRequestMode, args.modeFromInit);
    installFetchHook(args.hookedFetch, args.bridgeConfig);
    hookState.installed = true;
    args.onBridgeReady();
  };

  const uninstallBridgeHooks = () => {
    if (!hookState.installed) return;
    hookState.installed = false;
    restoreNativeRequest(args.nativeRequest, args.nativeRequestDescriptor);
    restoreNativeFetch(args.nativeFetch, args.nativeFetchDescriptor);
    const w = window as unknown as { __franzaiRequestHookInstalled?: boolean };
    w.__franzaiRequestHookInstalled = false;
  };

  const setBridgeActive = (active: boolean) => {
    if (active) installBridgeHooks();
    else uninstallBridgeHooks();
  };

  const syncBridgeHooksFromCache = () => {
    setBridgeActive(args.getDomainEnabled() === true);
  };

  return { installBridgeHooks, uninstallBridgeHooks, syncBridgeHooksFromCache, setBridgeActive, hookState };
}
