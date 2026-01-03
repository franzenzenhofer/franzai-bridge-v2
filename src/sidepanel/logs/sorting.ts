import type { LogEntry } from "../../shared/types";
import { getHost } from "../utils/url";
import { getSortState, setSortState, type SortColumn, type SortDir } from "../ui/prefs";

export function sortLogs(logsToSort: LogEntry[]): LogEntry[] {
  const { sortColumn, sortDir } = getSortState();
  const sorted = [...logsToSort];
  const dir = sortDir === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortColumn) {
      case "ts":
        cmp = a.ts - b.ts;
        break;
      case "method":
        cmp = a.method.localeCompare(b.method);
        break;
      case "host":
        cmp = getHost(a.url).localeCompare(getHost(b.url));
        break;
      case "url":
        cmp = a.url.localeCompare(b.url);
        break;
      case "status":
        cmp = (a.status ?? 0) - (b.status ?? 0);
        break;
      case "elapsed":
        cmp = (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0);
        break;
    }
    return cmp * dir;
  });

  return sorted;
}

export function updateSortIndicators(): void {
  const { sortColumn, sortDir } = getSortState();
  document.querySelectorAll(".table-header .sortable").forEach((el) => {
    el.classList.remove("asc", "desc");
    if (el.getAttribute("data-col") === sortColumn) {
      el.classList.add(sortDir);
    }
  });
}

export function updateSortState(next: SortColumn): void {
  const { sortColumn, sortDir } = getSortState();
  let newDir: SortDir = sortDir;
  let newCol: SortColumn = sortColumn;

  if (sortColumn === next) {
    newDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    newCol = next;
    newDir = next === "ts" ? "desc" : "asc";
  }

  setSortState(newCol, newDir);
}
