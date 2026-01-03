// Settings and domain preference handlers for background script

import type { BridgeSettings, BridgeStatus, DomainPreferences, LogEntry } from "../shared/types";
import { BG_EVT, type BgEvent } from "../shared/messages";
import {
  getSettings,
  setSettings,
  getLogs,
  clearLogs,
  getDomainPreference,
  getDomainPreferences,
  setDomainPreference,
  removeDomainPreference
} from "../shared/storage";
import { getConfiguredKeyNames, resolveKeyValue } from "../shared/keys";
import { BRIDGE_VERSION } from "../shared/constants";

export async function handleGetSettings(): Promise<{ ok: boolean; settings: BridgeSettings }> {
  const settings = await getSettings();
  return { ok: true, settings };
}

export async function handleSetSettings(
  newSettings: BridgeSettings,
  broadcast: (evt: BgEvent) => void
): Promise<{ ok: boolean }> {
  await setSettings(newSettings);
  broadcast({ type: BG_EVT.SETTINGS_UPDATED });
  return { ok: true };
}

export async function handleGetLogs(): Promise<{ ok: boolean; logs: LogEntry[] }> {
  const logs = await getLogs();
  return { ok: true, logs };
}

export async function handleClearLogs(broadcast: (evt: BgEvent) => void): Promise<{ ok: boolean }> {
  await clearLogs();
  broadcast({ type: BG_EVT.LOGS_UPDATED });
  return { ok: true };
}

export async function handleIsKeySet(keyName: string): Promise<{ ok: boolean; isSet: boolean }> {
  const settings = await getSettings();
  const isSet = !!(keyName && resolveKeyValue(settings.env, keyName));
  return { ok: true, isSet };
}

export async function handleGetKeyNames(): Promise<{ ok: boolean; keys: string[] }> {
  const settings = await getSettings();
  const keys = getConfiguredKeyNames(settings.env);
  return { ok: true, keys };
}

export async function handleGetDomainStatus(domain: string): Promise<{ ok: boolean; status: BridgeStatus; error?: string }> {
  if (!domain) {
    return { ok: false, error: "No domain provided", status: {} as BridgeStatus };
  }

  const settings = await getSettings();
  const pref = await getDomainPreference(domain);
  const hasApiKeys = Object.values(settings.env).some(v => v?.trim());

  let domainEnabled = false;
  let domainSource: "user" | "meta" | "default" = "default";

  if (pref) {
    domainEnabled = pref.enabled;
    domainSource = pref.source;
  }

  const originAllowed = true;
  const ready = domainEnabled && originAllowed;

  let reason = "";
  if (!domainEnabled) {
    reason = domainSource === "default"
      ? "Bridge is disabled for this domain. Enable it in the extension or add <meta name=\"franzai-bridge\" content=\"enabled\"> to your page."
      : "Bridge was disabled by user for this domain.";
  } else if (!hasApiKeys) {
    reason = "No API keys configured. Add keys in extension settings.";
  } else {
    reason = "Bridge is ready.";
  }

  const status: BridgeStatus = {
    installed: true,
    version: BRIDGE_VERSION,
    domainEnabled,
    domainSource,
    originAllowed,
    hasApiKeys,
    ready,
    reason
  };

  return { ok: true, status };
}

export async function handleSetDomainEnabled(
  domain: string,
  enabled: boolean,
  broadcast: (evt: BgEvent) => void
): Promise<{ ok: boolean; error?: string }> {
  if (!domain) {
    return { ok: false, error: "No domain provided" };
  }
  await setDomainPreference(domain, enabled, "user");
  broadcast({ type: BG_EVT.DOMAIN_PREFS_UPDATED });
  return { ok: true };
}

export async function handleGetAllDomainPrefs(): Promise<{ ok: boolean; prefs: DomainPreferences }> {
  const prefs = await getDomainPreferences();
  return { ok: true, prefs };
}

export async function handleReportMetaTag(
  domain: string,
  enabled: boolean,
  broadcast: (evt: BgEvent) => void
): Promise<{ ok: boolean; error?: string }> {
  if (!domain) {
    return { ok: false, error: "No domain provided" };
  }
  await setDomainPreference(domain, enabled, "meta");
  broadcast({ type: BG_EVT.DOMAIN_PREFS_UPDATED });
  return { ok: true };
}

export async function handleRemoveDomainPref(
  domain: string,
  broadcast: (evt: BgEvent) => void
): Promise<{ ok: boolean; error?: string }> {
  if (!domain) {
    return { ok: false, error: "No domain provided" };
  }
  await removeDomainPreference(domain);
  broadcast({ type: BG_EVT.DOMAIN_PREFS_UPDATED });
  return { ok: true };
}
