import { BRIDGE_SOURCE } from "../shared/constants";
import { PAGE_MSG } from "../shared/messages";
import { makeId } from "../shared/ids";
import { getBridgeWindow } from "./window";

let cachedKeyNames: string[] = [];
let keysPromise: Promise<string[]> | null = null;

export function getCachedKeyNames(): string[] {
  return cachedKeyNames;
}

export function updateKeyCache(keys: string[]): void {
  cachedKeyNames = keys;
  const win = getBridgeWindow();
  if (win.franzai) {
    win.franzai.keys = [...cachedKeyNames];
  }
}

export async function refreshKeyNames(): Promise<string[]> {
  if (keysPromise) return keysPromise;

  keysPromise = new Promise<string[]>((resolve) => {
    const keysId = makeId("keys");
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      keysPromise = null;
      resolve(cachedKeyNames);
    }, 5000);

    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const data = ev.data as { source?: string; type?: string; payload?: { keysId?: string; keys?: string[] } };
      if (!data || data.source !== BRIDGE_SOURCE) return;
      if (data.type !== PAGE_MSG.KEYS_RESPONSE) return;
      if (data.payload?.keysId !== keysId) return;

      clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      keysPromise = null;

      const nextKeys = Array.isArray(data.payload?.keys) ? data.payload.keys : [];
      updateKeyCache(nextKeys);
      resolve(cachedKeyNames);
    };

    window.addEventListener("message", onMessage);
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.KEYS_REQUEST,
      payload: { keysId }
    }, "*");
  });

  return keysPromise;
}
