import { state } from "../state";
import { setDomainEnabled, removeDomainPref } from "../data/domains";
import { showToast } from "../ui/toast";

export function updateDomainToggleUI(): void {
  const toggle = document.getElementById("domainToggle");
  const nameEl = document.getElementById("domainName");
  const checkbox = document.getElementById("domainEnabled") as HTMLInputElement | null;
  const sourceEl = document.getElementById("domainSource");

  if (!toggle || !nameEl || !checkbox || !sourceEl) return;

  if (!state.currentDomain) {
    toggle.classList.remove("enabled", "disabled");
    toggle.style.opacity = "0.5";
    nameEl.textContent = "—";
    checkbox.checked = false;
    checkbox.disabled = true;
    sourceEl.textContent = "";
    sourceEl.className = "domain-source";
    return;
  }

  toggle.style.opacity = "1";
  nameEl.textContent = state.currentDomain;
  nameEl.title = state.currentDomain;

  if (state.currentDomainStatus) {
    checkbox.checked = state.currentDomainStatus.domainEnabled;
    checkbox.disabled = false;
    toggle.classList.toggle("enabled", state.currentDomainStatus.domainEnabled);
    toggle.classList.toggle("disabled", !state.currentDomainStatus.domainEnabled);

    if (state.currentDomainStatus.domainSource === "user") {
      sourceEl.textContent = "user";
      sourceEl.className = "domain-source user";
    } else if (state.currentDomainStatus.domainSource === "meta") {
      sourceEl.textContent = "meta";
      sourceEl.className = "domain-source meta";
    } else {
      sourceEl.textContent = "";
      sourceEl.className = "domain-source";
    }
  } else {
    checkbox.checked = false;
    checkbox.disabled = true;
    toggle.classList.remove("enabled");
    toggle.classList.add("disabled");
    sourceEl.textContent = "";
    sourceEl.className = "domain-source";
  }
}

export function renderDomainsTable(onUpdate: () => Promise<void> | void): void {
  const table = document.getElementById("domainsTable");
  if (!table) return;

  table.innerHTML = "";
  const domains = Object.keys(state.allDomainPrefs).sort();

  if (!domains.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "No domain preferences yet. Enable the bridge on a page to add it here.";
    table.appendChild(hint);
    return;
  }

  for (const domain of domains) {
    const pref = state.allDomainPrefs[domain];
    if (!pref) continue;
    const row = document.createElement("div");
    row.className = `domain-row ${pref.enabled ? "enabled" : "disabled"}`;

    const info = document.createElement("div");
    info.className = "domain-row-info";

    const name = document.createElement("div");
    name.className = "domain-row-name";
    name.textContent = domain;

    const meta = document.createElement("div");
    meta.className = "domain-row-meta";

    const sourceSpan = document.createElement("span");
    sourceSpan.className = `domain-row-source ${pref.source}`;
    sourceSpan.textContent = pref.source;
    meta.appendChild(sourceSpan);

    const timeSpan = document.createElement("span");
    const date = new Date(pref.lastModified);
    timeSpan.textContent = date.toLocaleDateString();
    timeSpan.title = date.toLocaleString();
    meta.appendChild(timeSpan);

    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "domain-row-actions";

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "toggle-switch";
    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.checked = pref.enabled;
    toggleInput.onchange = async () => {
      const resp = await setDomainEnabled(domain, toggleInput.checked);
      if (resp.ok) {
        showToast(`Bridge ${toggleInput.checked ? "enabled" : "disabled"} for ${domain}`);
        void onUpdate();
      } else {
        showToast(resp.error ?? "Failed to update domain", true);
      }
    };
    const toggleSlider = document.createElement("span");
    toggleSlider.className = "toggle-slider";
    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(toggleSlider);
    actions.appendChild(toggleLabel);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "domain-delete-btn";
    deleteBtn.title = "Remove preference";
    deleteBtn.innerHTML = "<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg>";
    deleteBtn.onclick = async () => {
      const resp = await removeDomainPref(domain);
      if (resp.ok) {
        showToast(`Removed preference for ${domain}`);
        void onUpdate();
      } else {
        showToast(resp.error ?? "Failed to remove domain", true);
      }
    };
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(actions);
    table.appendChild(row);
  }
}
