import { updateSortState } from "./sorting";
import { saveUIPrefs } from "../ui/prefs";

export function initSortControls(onChange: () => void): void {
  document.querySelectorAll<HTMLElement>(".table-header .sortable").forEach((el) => {
    el.onclick = () => {
      const col = el.getAttribute("data-col");
      if (!col) return;
      updateSortState(col as "ts" | "method" | "host" | "url" | "status" | "elapsed");
      onChange();
      saveUIPrefs();
    };
  });
}
