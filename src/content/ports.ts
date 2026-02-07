import { BG_EVT, BG_MSG, PAGE_MSG, type BgEvent } from "../shared/messages";
import { BRIDGE_SOURCE } from "../shared/constants";
import { createLogger } from "../shared/logger";
import { sendRuntimeMessage } from "../shared/runtime";
import { fetchDomainStatus } from "./domain-status";
import { resolveCurrentDomain } from "./domain";

const log = createLogger("content-port");

async function handleDomainPrefsUpdate(): Promise<void> {
  const domain = resolveCurrentDomain();
  if (!domain) return;
  try {
    const status = await fetchDomainStatus(domain);
    log.info("Domain status updated, notifying page:", status.domainEnabled);
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: PAGE_MSG.DOMAIN_ENABLED_UPDATE,
      payload: { enabled: status.domainEnabled, source: status.domainSource }
    }, "*");
  } catch (e) {
    log.warn("Failed to fetch updated domain status", e);
  }
}

async function handleSettingsUpdate(): Promise<void> {
  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.GET_KEY_NAMES },
      { ok: boolean; keys: string[] }
    >({ type: BG_MSG.GET_KEY_NAMES });

    if (resp.ok && Array.isArray(resp.keys)) {
      window.postMessage({
        source: BRIDGE_SOURCE,
        type: PAGE_MSG.KEYS_UPDATE,
        payload: { keys: resp.keys }
      }, "*");
    }
  } catch (e) {
    log.warn("Failed to fetch updated key list", e);
  }
}

export function registerBackgroundPort(): void {
  const port = chrome.runtime.connect({ name: "FRANZAI_CONTENT" });
  port.onMessage.addListener(async (evt: BgEvent) => {
    if (evt.type === BG_EVT.DOMAIN_PREFS_UPDATED) {
      await handleDomainPrefsUpdate();
    }
    if (evt.type === BG_EVT.SETTINGS_UPDATED) {
      await handleSettingsUpdate();
    }
    if (evt.type === BG_EVT.GOOGLE_AUTH_UPDATED) {
      window.postMessage({
        source: BRIDGE_SOURCE,
        type: PAGE_MSG.GOOGLE_AUTH_UPDATE,
        payload: evt.payload
      }, "*");
    }
  });
}
