import { BRIDGE_VERSION } from "../shared/constants";
import { initGoogleAccount } from "./google-account";
import { loadAll } from "./loader";
import { initLogActions } from "./logs/actions";
import { initFilterInputs } from "./logs/filters-inputs";
import { initKeyboardShortcuts } from "./logs/keyboard";
import { renderLogs } from "./logs/render";
import { initSortControls } from "./logs/sort-ui";
import { initNavigation } from "./navigation";
import { loadDomainState } from "./domains/loader";
import { initDomainToggle } from "./domains/toggle";
import { initRuntimeListeners } from "./runtime";
import { initDestinations } from "./settings/destinations";
import { initEnvActions } from "./settings/env-actions";
import { renderSettings } from "./settings/render";
import { initResetSettings } from "./settings/reset";
import { initRules } from "./settings/rules";
import { registerSettingsRenderer } from "./settings/store";
import { loadUIPrefs } from "./ui/prefs";
import { initResizableColumns, initResizableSplit } from "./ui/resizable";

async function bootstrap(): Promise<void> {
  registerSettingsRenderer(renderSettings);

  initFilterInputs(renderLogs);
  initSortControls(renderLogs);
  initKeyboardShortcuts();
  initLogActions(loadAll);

  initEnvActions();
  initDestinations();
  initRules();
  initResetSettings(loadAll);

  initNavigation(loadDomainState);
  initDomainToggle(loadDomainState);

  const versionEl = document.getElementById("version");
  if (versionEl) versionEl.textContent = `v${BRIDGE_VERSION}`;

  const googleContainer = document.getElementById("googleAccountContainer");
  if (googleContainer) {
    initGoogleAccount(googleContainer);
  }

  await loadUIPrefs();
  initResizableColumns();
  initResizableSplit();

  await loadAll();
  await loadDomainState();

  initRuntimeListeners({
    onRefresh: loadAll,
    onDomainPrefs: loadDomainState,
    onActiveTab: loadDomainState
  });
}

bootstrap();
