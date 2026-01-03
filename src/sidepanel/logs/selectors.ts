import type { LogEntry } from "../../shared/types";
import { state } from "../state";
import { getOriginHostname } from "../utils/url";
import { filterLogs } from "./filters";
import { sortLogs } from "./sorting";

export type VisibleLogs = {
  domainLogs: LogEntry[];
  filteredLogs: LogEntry[];
  sortedLogs: LogEntry[];
};

function filterLogsByDomain(logs: LogEntry[]): LogEntry[] {
  if (!state.currentDomain) return [];
  return logs.filter((l) => getOriginHostname(l.pageOrigin) === state.currentDomain);
}

export function getVisibleLogs(): VisibleLogs {
  const domainLogs = filterLogsByDomain(state.logs);
  const filteredLogs = filterLogs(domainLogs);
  const sortedLogs = sortLogs(filteredLogs);
  return { domainLogs, filteredLogs, sortedLogs };
}
