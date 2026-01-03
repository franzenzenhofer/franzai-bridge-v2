import type { LogEntry } from "../../shared/types";

let filterSearch = "";
let filterMethod = "";
let filterStatus = "";

export function setFilterSearch(value: string): void {
  filterSearch = value;
}

export function setFilterMethod(value: string): void {
  filterMethod = value;
}

export function setFilterStatus(value: string): void {
  filterStatus = value;
}

export function clearFilterState(): void {
  filterSearch = "";
  filterMethod = "";
  filterStatus = "";
}

export function hasActiveFilters(): boolean {
  return filterSearch !== "" || filterMethod !== "" || filterStatus !== "";
}

export function filterLogs(logsToFilter: LogEntry[]): LogEntry[] {
  return logsToFilter.filter((l) => {
    if (filterSearch && !l.url.toLowerCase().includes(filterSearch.toLowerCase())) {
      return false;
    }
    if (filterMethod && l.method !== filterMethod) {
      return false;
    }
    if (filterStatus) {
      const status = l.status ?? 0;
      if (filterStatus === "success" && (status < 200 || status >= 300)) return false;
      if (filterStatus === "redirect" && (status < 300 || status >= 400)) return false;
      if (filterStatus === "error" && status < 400 && !l.error) return false;
    }
    return true;
  });
}
