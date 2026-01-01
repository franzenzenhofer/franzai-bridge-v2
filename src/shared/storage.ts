import type { BridgeSettings, LogEntry, Dict, DomainPreference, DomainPreferences } from "./types";
import { normalizeSettings } from "./normalize";
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from "./defaults";
import { createLogger } from "./logger";

const log = createLogger("storage");

const SETTINGS_KEY = "franzaiSettings";
const LOGS_KEY = "franzaiLogs";
const DOMAIN_PREFS_KEY = "franzaiDomainPrefs";

function sessionStorageOrLocal(): chrome.storage.StorageArea {
  const anyChrome = chrome as unknown as { storage?: { session?: chrome.storage.StorageArea } };
  return anyChrome.storage?.session ?? chrome.storage.local;
}

/**
 * Migrate old settings to new defaults while preserving user's ENV vars (API keys).
 * This runs automatically when settingsVersion is outdated or missing.
 */
function migrateSettings(oldSettings: Partial<BridgeSettings> | undefined): BridgeSettings {
  const newSettings = structuredClone(DEFAULT_SETTINGS);

  // Preserve user's ENV vars (API keys) - these are valuable!
  if (oldSettings?.env) {
    for (const [key, value] of Object.entries(oldSettings.env)) {
      if (value && value.trim() !== "") {
        newSettings.env[key] = value;
      }
    }
  }

  // Preserve user's custom injection rules
  if (oldSettings?.injectionRules && oldSettings.injectionRules.length > 0) {
    newSettings.injectionRules = oldSettings.injectionRules;
  }

  log.info("Settings migrated to version", SETTINGS_VERSION, "preserving ENV vars and rules");
  return newSettings;
}

export async function getSettings(): Promise<BridgeSettings> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = data[SETTINGS_KEY] as Partial<BridgeSettings> | undefined;

  // Check if migration needed (missing version or older version)
  const storedVersion = stored?.settingsVersion ?? 0;
  if (storedVersion < SETTINGS_VERSION) {
    log.info("Settings version outdated:", storedVersion, "→", SETTINGS_VERSION, "- migrating");
    const migrated = migrateSettings(stored);
    await setSettings(migrated);
    return migrated;
  }

  return normalizeSettings(stored as BridgeSettings | undefined);
}

export async function setSettings(settings: BridgeSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
}

export async function getLogs(): Promise<LogEntry[]> {
  const store = sessionStorageOrLocal();
  const data = await store.get(LOGS_KEY);
  return (data[LOGS_KEY] as LogEntry[]) ?? [];
}

export async function setLogs(logs: LogEntry[]): Promise<void> {
  const store = sessionStorageOrLocal();
  await store.set({ [LOGS_KEY]: logs });
}

export async function appendLog(entry: LogEntry, maxLogs: number): Promise<void> {
  const logs = await getLogs();
  logs.unshift(entry);
  logs.length = Math.min(logs.length, maxLogs);
  await setLogs(logs);
}

export async function clearLogs(): Promise<void> {
  const store = sessionStorageOrLocal();
  await store.remove(LOGS_KEY);
}

// =============================================================================
// Domain Preferences Storage
// =============================================================================

export async function getDomainPreferences(): Promise<DomainPreferences> {
  const data = await chrome.storage.local.get(DOMAIN_PREFS_KEY);
  return (data[DOMAIN_PREFS_KEY] as DomainPreferences) ?? {};
}

export async function setDomainPreferences(prefs: DomainPreferences): Promise<void> {
  await chrome.storage.local.set({ [DOMAIN_PREFS_KEY]: prefs });
}

export async function getDomainPreference(domain: string): Promise<DomainPreference | null> {
  const prefs = await getDomainPreferences();
  return prefs[domain] ?? null;
}

export async function setDomainPreference(
  domain: string,
  enabled: boolean,
  source: "user" | "meta"
): Promise<void> {
  const prefs = await getDomainPreferences();

  // User preference always wins - if existing is 'user', only update if new is also 'user'
  const existing = prefs[domain];
  if (existing?.source === "user" && source === "meta") {
    // Don't overwrite user preference with meta tag
    return;
  }

  prefs[domain] = {
    enabled,
    source,
    lastModified: Date.now()
  };

  await setDomainPreferences(prefs);
}

export async function removeDomainPreference(domain: string): Promise<void> {
  const prefs = await getDomainPreferences();
  delete prefs[domain];
  await setDomainPreferences(prefs);
}
