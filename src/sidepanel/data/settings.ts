import type { BridgeSettings, LogEntry } from "../../shared/types";
import { BG_MSG } from "../../shared/messages";
import { sendRuntimeMessage } from "../../shared/runtime";
import { state } from "../state";

export async function loadSettings(): Promise<BridgeSettings | null> {
  const resp = await sendRuntimeMessage<{ type: typeof BG_MSG.GET_SETTINGS }, { ok: boolean; settings?: BridgeSettings; error?: string }>({
    type: BG_MSG.GET_SETTINGS
  });
  if (resp.ok && resp.settings) {
    state.settings = resp.settings;
    return resp.settings;
  }
  return null;
}

export async function saveSettings(next: BridgeSettings): Promise<{ ok: boolean; error?: string }> {
  const resp = await sendRuntimeMessage<
    { type: typeof BG_MSG.SET_SETTINGS; payload: BridgeSettings },
    { ok: boolean; error?: string }
  >({
    type: BG_MSG.SET_SETTINGS,
    payload: next
  });

  if (resp.ok) {
    state.settings = next;
  }

  return resp;
}

export async function loadLogs(): Promise<LogEntry[]> {
  const resp = await sendRuntimeMessage<{ type: typeof BG_MSG.GET_LOGS }, { ok: boolean; logs?: LogEntry[] }>(
    { type: BG_MSG.GET_LOGS }
  );
  if (resp.ok && resp.logs) {
    state.logs = resp.logs;
    return resp.logs;
  }
  state.logs = [];
  return [];
}

export async function clearLogs(): Promise<{ ok: boolean; error?: string }> {
  return sendRuntimeMessage<{ type: typeof BG_MSG.CLEAR_LOGS }, { ok: boolean; error?: string }>({
    type: BG_MSG.CLEAR_LOGS
  });
}
