import type { BridgeSettings } from "../../shared/types";
import { saveSettings as persistSettings } from "../data/settings";
import { state } from "../state";

let onSettingsChanged: (() => void) | null = null;

export function registerSettingsRenderer(fn: () => void): void {
  onSettingsChanged = fn;
}

export async function updateSettings(next: BridgeSettings): Promise<{ ok: boolean; error?: string }> {
  const resp = await persistSettings(next);
  if (resp.ok) {
    state.settings = next;
    onSettingsChanged?.();
  }
  return resp;
}
