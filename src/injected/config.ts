import type { BridgeConfig, BridgeMode } from "./types";
import { getBridgeWindow } from "./window";

export function normalizeMode(mode: unknown): BridgeMode | undefined {
  if (mode === "auto" || mode === "always" || mode === "off") return mode;
  return undefined;
}

export function getBridgeConfig(): BridgeConfig {
  const win = getBridgeWindow();
  const existing = win.__franzaiBridgeConfig;
  const config: Partial<BridgeConfig> = existing && typeof existing === "object" ? existing : {};

  const normalized = normalizeMode(config.mode) ?? "always";
  const lockHooks = config.lockHooks !== false;

  const finalConfig: BridgeConfig = { mode: normalized, lockHooks };
  win.__franzaiBridgeConfig = finalConfig;
  return finalConfig;
}
