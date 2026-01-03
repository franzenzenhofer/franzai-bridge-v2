import type { BridgeSettings, BridgeStatus, DomainPreferences, LogEntry } from "../shared/types";

export const state = {
  settings: null as BridgeSettings | null,
  logs: [] as LogEntry[],
  selectedLogId: null as string | null,
  currentDomain: null as string | null,
  currentDomainStatus: null as BridgeStatus | null,
  allDomainPrefs: {} as DomainPreferences
};
