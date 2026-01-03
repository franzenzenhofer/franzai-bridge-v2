import { BG_MSG, PAGE_MSG } from "../../shared/messages";
import { BRIDGE_SOURCE } from "../../shared/constants";
import { createLogger } from "../../shared/logger";
import { sendRuntimeMessage } from "../../shared/runtime";

const log = createLogger("content-keys");

export async function handleKeysRequest(keysId: string): Promise<void> {
  if (!keysId) return;

  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.GET_KEY_NAMES },
      { ok: boolean; keys: string[] }
    >({ type: BG_MSG.GET_KEY_NAMES });

    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.KEYS_RESPONSE,
      payload: { keysId, keys: resp.ok ? resp.keys : [] }
    }, "*");
  } catch (e) {
    log.warn("Failed to fetch key list", e);
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.KEYS_RESPONSE,
      payload: { keysId, keys: [] }
    }, "*");
  }
}
