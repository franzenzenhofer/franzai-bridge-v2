import { state } from "../state";
import { getCurrentTabDomain, fetchDomainStatus, fetchAllDomainPrefs } from "../data/domains";
import { closeDetailPane, renderLogs } from "../logs/render";
import { renderDomainsTable, updateDomainToggleUI } from "./render";

export async function loadDomainState(): Promise<void> {
  const previousDomain = state.currentDomain;
  state.currentDomain = await getCurrentTabDomain();

  if (state.currentDomain) {
    state.currentDomainStatus = await fetchDomainStatus(state.currentDomain);
  } else {
    state.currentDomainStatus = null;
  }

  state.allDomainPrefs = await fetchAllDomainPrefs();

  updateDomainToggleUI();
  renderDomainsTable(loadDomainState);

  if (previousDomain !== state.currentDomain) {
    closeDetailPane();
  }
  renderLogs();
}
