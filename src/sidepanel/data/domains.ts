import type { BridgeStatus, DomainPreferences } from "../../shared/types";
import { BG_MSG } from "../../shared/messages";
import { sendRuntimeMessage } from "../../shared/runtime";

export async function getCurrentTabDomain(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return null;
    const url = new URL(tab.url);
    if (url.protocol === "chrome:" || url.protocol === "chrome-extension:") return null;
    return url.hostname;
  } catch {
    return null;
  }
}

export async function fetchDomainStatus(domain: string): Promise<BridgeStatus | null> {
  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.GET_DOMAIN_STATUS; payload: { domain: string } },
      { ok: boolean; status: BridgeStatus }
    >({
      type: BG_MSG.GET_DOMAIN_STATUS,
      payload: { domain }
    });
    return resp.ok ? resp.status : null;
  } catch {
    return null;
  }
}

export async function fetchAllDomainPrefs(): Promise<DomainPreferences> {
  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.GET_ALL_DOMAIN_PREFS },
      { ok: boolean; prefs: DomainPreferences }
    >({
      type: BG_MSG.GET_ALL_DOMAIN_PREFS
    });
    return resp.ok ? resp.prefs : {};
  } catch {
    return {};
  }
}

export async function setDomainEnabled(domain: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  return sendRuntimeMessage({
    type: BG_MSG.SET_DOMAIN_ENABLED,
    payload: { domain, enabled }
  });
}

export async function removeDomainPref(domain: string): Promise<{ ok: boolean; error?: string }> {
  return sendRuntimeMessage({
    type: BG_MSG.REMOVE_DOMAIN_PREF,
    payload: { domain }
  });
}
