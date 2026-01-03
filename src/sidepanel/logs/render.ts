import { state } from "../state";
import { createLogItem } from "./item";
import { renderDetails } from "./details";
import { updateFilterUI, clearFilters } from "./filters-ui";
import { updateSortIndicators } from "./sorting";
import { getSortState } from "../ui/prefs";
import { getVisibleLogs } from "./selectors";
import { applyColumnWidths } from "../ui/resizable";

export function closeDetailPane(): void {
  state.selectedLogId = null;
  const detailPane = document.getElementById("detailPane");
  if (detailPane) detailPane.classList.remove("visible");
  document.querySelectorAll(".item.active").forEach((el) => el.classList.remove("active"));
}

export function renderLogs(): void {
  const logsList = document.getElementById("logsList");
  if (!logsList) return;
  const detailPane = document.getElementById("detailPane");
  const prevScrollTop = logsList.scrollTop;
  const prevScrollHeight = logsList.scrollHeight;
  const wasAtBottom = prevScrollTop + logsList.clientHeight >= prevScrollHeight - 8;

  const fragment = document.createDocumentFragment();
  logsList.innerHTML = "";

  if (!state.logs.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "No requests captured yet. Make fetch calls to see them here.";
    logsList.appendChild(hint);
    if (detailPane) detailPane.classList.remove("visible");
    updateFilterUI(0, 0);
    return;
  }

  const { domainLogs, filteredLogs, sortedLogs } = getVisibleLogs();
  if (!domainLogs.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = state.currentDomain
      ? `No requests for ${state.currentDomain} yet.`
      : "No active domain selected.";
    logsList.appendChild(hint);
    if (detailPane) detailPane.classList.remove("visible");
    updateFilterUI(0, 0);
    return;
  }

  updateFilterUI(filteredLogs.length, domainLogs.length);

  if (!filteredLogs.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.innerHTML = "No requests match your filters. <a href=\"#\" id=\"clearFiltersLink\">Clear filters</a>";
    logsList.appendChild(hint);
    const clearLink = document.getElementById("clearFiltersLink");
    if (clearLink) {
      clearLink.onclick = (e) => {
        e.preventDefault();
        clearFilters(renderLogs);
      };
    }
    if (detailPane) detailPane.classList.remove("visible");
    return;
  }

  if (state.selectedLogId && !filteredLogs.some((l) => l.id === state.selectedLogId)) {
    closeDetailPane();
  }

  for (const log of sortedLogs) {
    const div = createLogItem(log, state.selectedLogId);
    div.onclick = () => {
      if (state.selectedLogId === log.id) {
        closeDetailPane();
        return;
      }
      state.selectedLogId = log.id;
      document.querySelectorAll(".item.active").forEach((el) => el.classList.remove("active"));
      div.classList.add("active");
      renderDetails(log);
      if (detailPane) detailPane.classList.add("visible");
    };
    fragment.appendChild(div);
  }

  logsList.appendChild(fragment);

  applyColumnWidths();
  const { sortColumn, sortDir } = getSortState();
  if (sortColumn === "ts" && sortDir === "desc" && wasAtBottom) {
    logsList.scrollTop = logsList.scrollHeight;
  } else {
    logsList.scrollTop = Math.min(prevScrollTop, logsList.scrollHeight);
  }

  updateSortIndicators();

  if (state.selectedLogId && detailPane) {
    detailPane.classList.add("visible");
  }
}
