import { BG_MSG, PAGE_MSG } from "../../shared/messages";
import { BRIDGE_SOURCE } from "../../shared/constants";
import { createLogger } from "../../shared/logger";
import { sendRuntimeMessage } from "../../shared/runtime";

const log = createLogger("content-keys");

export async function handleKeyCheck(checkId: string, keyName: string): Promise<void> {
  if (!checkId || !keyName) return;

  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.IS_KEY_SET; payload: { keyName: string } },
      { ok: boolean; isSet: boolean }
    >({
      type: BG_MSG.IS_KEY_SET,
      payload: { keyName }
    });

    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.KEY_CHECK_RESPONSE,
      payload: { checkId, isSet: resp.isSet }
    }, "*");
  } catch (e) {
    log.warn("Failed to check key", e);
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.KEY_CHECK_RESPONSE,
      payload: { checkId, isSet: false }
    }, "*");
  }
}
