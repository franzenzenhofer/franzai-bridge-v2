import { state } from "../state";
import { getVisibleLogs } from "./selectors";
import { closeDetailPane } from "./render";
import { renderDetails } from "./details";
import { showToast } from "../ui/toast";

export function initKeyboardShortcuts(): void {
  document.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
      if (e.key === "Escape") target.blur();
      return;
    }

    if (e.key === "Escape" && state.selectedLogId) {
      closeDetailPane();
      return;
    }

    if (e.key === "j" || e.key === "k" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const { sortedLogs } = getVisibleLogs();
      if (!sortedLogs.length) return;

      const currentIndex = state.selectedLogId
        ? sortedLogs.findIndex((l) => l.id === state.selectedLogId)
        : -1;

      let newIndex = currentIndex;
      if (e.key === "j" || e.key === "ArrowDown") {
        newIndex = currentIndex < sortedLogs.length - 1 ? currentIndex + 1 : 0;
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : sortedLogs.length - 1;
      }

      const newLog = sortedLogs[newIndex];
      state.selectedLogId = newLog.id;
      renderDetails(newLog);

      document.querySelectorAll(".item.active").forEach((el) => el.classList.remove("active"));
      const items = document.querySelectorAll("#logsList .item");
      if (items[newIndex]) {
        items[newIndex].classList.add("active");
        (items[newIndex] as HTMLElement).scrollIntoView({ block: "nearest" });
      }

      const detailPane = document.getElementById("detailPane");
      if (detailPane) detailPane.classList.add("visible");
      return;
    }

    if (e.key === "c" && state.selectedLogId) {
      const log = state.logs.find((l) => l.id === state.selectedLogId);
      if (log) {
        navigator.clipboard.writeText(log.url);
        showToast("URL copied to clipboard");
      }
      return;
    }

    if (e.key === "/") {
      e.preventDefault();
      const searchInput = document.getElementById("filterSearch") as HTMLInputElement | null;
      if (searchInput) searchInput.focus();
      return;
    }

    if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
      const refreshBtn = document.getElementById("btnRefresh") as HTMLButtonElement | null;
      refreshBtn?.click();
    }
  });
}
