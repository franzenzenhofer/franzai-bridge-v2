import { debounce } from "../utils/debounce";

const UI_PREFS_KEY = "franzai_ui_prefs";
const DEFAULT_COL_WIDTHS = [50, 45, 90, -1, 45, 40];

export type SortColumn = "ts" | "method" | "host" | "url" | "status" | "elapsed";
export type SortDir = "asc" | "desc";

let colWidths = [...DEFAULT_COL_WIDTHS];
let sortColumn: SortColumn = "ts";
let sortDir: SortDir = "desc";

export function getColWidths(): number[] {
  return colWidths;
}

export function setColWidth(index: number, width: number): void {
  colWidths[index] = width;
}

export function getSortState() {
  return { sortColumn, sortDir };
}

export function setSortState(column: SortColumn, dir: SortDir): void {
  sortColumn = column;
  sortDir = dir;
}

export async function loadUIPrefs(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(UI_PREFS_KEY);
    const prefs = data[UI_PREFS_KEY];
    if (prefs) {
      if (prefs.colWidths) colWidths = prefs.colWidths;
      if (prefs.sortColumn) sortColumn = prefs.sortColumn;
      if (prefs.sortDir) sortDir = prefs.sortDir;
    }
  } catch {
    // Ignore load failures.
  }
}

export const saveUIPrefs = debounce(async () => {
  try {
    await chrome.storage.local.set({
      [UI_PREFS_KEY]: { colWidths, sortColumn, sortDir }
    });
  } catch {
    // Ignore save failures.
  }
}, 500);
