/**
 * Bridge AI IDE - Status Bar Component
 */

import { el } from "../utils/dom";
import { getState, subscribe, setState } from "../state/store";

export function initStatusBar(): void {
  const container = document.getElementById("status-bar");
  if (!container) return;

  render();
  subscribe(render);
}

function render(): void {
  const container = document.getElementById("status-bar");
  if (!container) return;

  const state = getState();

  // Clear using DOM method
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Logo
  const logo = el("span", "logo", "Bridge AI IDE");
  container.appendChild(logo);

  // Version
  const version = el("span", "version");
  version.textContent = state.extension.ready
    ? `v${state.extension.version}`
    : "Disconnected";
  container.appendChild(version);

  // Key indicators
  const keys = el("div", "keys");

  const keyConfigs = [
    { key: "openai", label: "OpenAI" },
    { key: "anthropic", label: "Claude" },
    { key: "gemini", label: "Gemini" }
  ] as const;

  for (const { key, label } of keyConfigs) {
    const indicator = el("div", "key-indicator");
    const dot = el("span", "key-dot");
    if (state.keys[key]) dot.classList.add("active");
    indicator.appendChild(dot);
    indicator.appendChild(document.createTextNode(label));
    keys.appendChild(indicator);
  }

  container.appendChild(keys);
}

export async function checkExtension(): Promise<void> {
  const ghostOverlay = document.getElementById("ghost-overlay");

  // Check if franzai is available
  const win = window as Window & { franzai?: { ping: () => Promise<{ ok: boolean; version: string }>; keys: string[] } };

  if (!win.franzai) {
    ghostOverlay?.classList.add("visible");
    return;
  }

  try {
    const result = await win.franzai.ping();
    if (result.ok) {
      ghostOverlay?.classList.remove("visible");

      setState({
        extension: { ready: true, version: result.version },
        keys: {
          openai: win.franzai.keys.includes("openai"),
          anthropic: win.franzai.keys.includes("anthropic"),
          gemini: win.franzai.keys.includes("gemini")
        }
      });
    }
  } catch {
    ghostOverlay?.classList.add("visible");
  }
}
