import { state } from "../state";
import { setDomainEnabled } from "../data/domains";
import { showToast } from "../ui/toast";

export function initDomainToggle(onUpdate: () => Promise<void> | void): void {
  const checkbox = document.getElementById("domainEnabled") as HTMLInputElement | null;
  if (!checkbox) return;

  checkbox.onchange = async () => {
    if (!state.currentDomain) return;
    const resp = await setDomainEnabled(state.currentDomain, checkbox.checked);
    if (resp.ok) {
      showToast(`Bridge ${checkbox.checked ? "enabled" : "disabled"} for ${state.currentDomain}`);
      void onUpdate();
    } else {
      showToast(resp.error ?? "Failed to update domain", true);
    }
  };
}
