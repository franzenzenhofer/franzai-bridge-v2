export type SidepanelTab = "requests" | "settings" | "advanced" | "domains";

function setActive(tab: SidepanelTab): void {
  const requestsPage = document.getElementById("tab-requests");
  const settingsPage = document.getElementById("tab-settings");
  const advancedPage = document.getElementById("tab-advanced");
  const domainsPage = document.getElementById("tab-domains");
  const requestsToolbar = document.getElementById("toolbar-requests");
  const settingsToolbar = document.getElementById("toolbar-settings");
  const advancedToolbar = document.getElementById("toolbar-advanced");
  const domainsToolbar = document.getElementById("toolbar-domains");
  const settingsBtn = document.getElementById("btnSettings");
  const domainsBtn = document.getElementById("btnDomains");

  requestsPage?.classList.remove("active");
  settingsPage?.classList.remove("active");
  advancedPage?.classList.remove("active");
  domainsPage?.classList.remove("active");
  requestsToolbar?.classList.add("hidden");
  settingsToolbar?.classList.add("hidden");
  advancedToolbar?.classList.add("hidden");
  domainsToolbar?.classList.add("hidden");
  settingsBtn?.classList.remove("active");
  domainsBtn?.classList.remove("active");

  if (tab === "settings") {
    settingsPage?.classList.add("active");
    settingsToolbar?.classList.remove("hidden");
    settingsBtn?.classList.add("active");
  } else if (tab === "advanced") {
    advancedPage?.classList.add("active");
    advancedToolbar?.classList.remove("hidden");
    settingsBtn?.classList.add("active");
  } else if (tab === "domains") {
    domainsPage?.classList.add("active");
    domainsToolbar?.classList.remove("hidden");
    domainsBtn?.classList.add("active");
  } else {
    requestsPage?.classList.add("active");
    requestsToolbar?.classList.remove("hidden");
  }
}

export function initNavigation(onDomainsOpen: () => Promise<void> | void): void {
  const settingsBtn = document.getElementById("btnSettings");
  const domainsBtn = document.getElementById("btnDomains");
  const backToRequests = document.getElementById("btnBackToRequests");
  const backFromDomains = document.getElementById("btnBackFromDomains");
  const backToSettings = document.getElementById("btnBackToSettings");
  const advancedLink = document.getElementById("advancedLink");
  const logoBtn = document.getElementById("btnLogo");

  settingsBtn?.addEventListener("click", () => setActive("settings"));
  domainsBtn?.addEventListener("click", () => {
    setActive("domains");
    void onDomainsOpen();
  });
  backToRequests?.addEventListener("click", () => setActive("requests"));
  backFromDomains?.addEventListener("click", () => setActive("requests"));
  backToSettings?.addEventListener("click", () => setActive("settings"));
  advancedLink?.addEventListener("click", () => setActive("advanced"));

  if (logoBtn) {
    logoBtn.addEventListener("click", () => setActive("requests"));
    logoBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setActive("requests");
      }
    });
  }
}
