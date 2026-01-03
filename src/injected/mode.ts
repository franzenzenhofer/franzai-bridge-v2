import type { BridgeInit, BridgeMode } from "./types";
import { normalizeMode } from "./config";
import { getRequestMode } from "./request-meta";

export function modeFromInit(init?: BridgeInit): BridgeMode | undefined {
  return normalizeMode(init?.franzai?.mode);
}

export function resolveBridgeMode(
  input: RequestInfo | URL,
  init: BridgeInit | undefined,
  fallbackMode: BridgeMode
): BridgeMode {
  const initMode = modeFromInit(init);
  if (initMode) return initMode;

  if (input instanceof Request) {
    const requestMode = getRequestMode(input);
    if (requestMode) return requestMode;
  }

  return fallbackMode;
}
