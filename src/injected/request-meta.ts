import type { BridgeMode } from "./types";

const REQUEST_META = Symbol.for("franzaiBridgeMeta");

export function setRequestMode(request: Request, mode?: BridgeMode): void {
  if (!mode) return;
  try {
    Object.defineProperty(request, REQUEST_META, {
      value: mode,
      enumerable: false
    });
  } catch {
    // Ignore metadata errors; fallback to global mode.
  }
}

export function getRequestMode(request: Request): BridgeMode | undefined {
  const meta = request as unknown as { [REQUEST_META]?: BridgeMode };
  return meta[REQUEST_META];
}
