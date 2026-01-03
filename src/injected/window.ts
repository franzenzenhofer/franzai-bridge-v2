import type { BridgeConfig, FranzAIBridge } from "./types";

export type BridgeWindow = Window & {
  __franzaiBridgeInstalled?: boolean;
  __franzaiNativeFetch?: typeof fetch;
  __franzaiNativeRequest?: typeof Request;
  __franzaiNativeFetchDescriptor?: PropertyDescriptor | null;
  __franzaiNativeRequestDescriptor?: PropertyDescriptor | null;
  __franzaiBridgeConfig?: BridgeConfig;
  franzai?: FranzAIBridge;
};

export function getBridgeWindow(): BridgeWindow {
  return window as BridgeWindow;
}
