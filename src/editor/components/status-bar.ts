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
    { key: "google", label: "Gemini" }
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
  const win = window as Window & {
    franzai?: {
      ping: () => Promise<{ ok: boolean; version: string }>;
      keys: string[];
      hasApiKey: (name: string) => Promise<boolean>;
    }
  };

  if (!win.franzai) {
    ghostOverlay?.classList.add("visible");
    return;
  }

  try {
    const result = await win.franzai.ping();
    if (result.ok) {
      ghostOverlay?.classList.remove("visible");

      // Wait a bit for keys to populate, then check
      await new Promise(r => setTimeout(r, 100));

      // Debug: log available keys
      console.log("[Bridge AI IDE] Available keys array:", win.franzai.keys);

      // Use hasApiKey for more reliable detection
      const [hasOpenAI, hasAnthropic, hasGoogle] = await Promise.all([
        win.franzai.hasApiKey("OPENAI_API_KEY"),
        win.franzai.hasApiKey("ANTHROPIC_API_KEY"),
        win.franzai.hasApiKey("GOOGLE_API_KEY")
      ]);

      console.log("[Bridge AI IDE] Key detection via hasApiKey:", {
        openai: hasOpenAI,
        anthropic: hasAnthropic,
        gemini: hasGoogle
      });

      setState({
        extension: { ready: true, version: result.version },
        keys: {
          openai: hasOpenAI,
          anthropic: hasAnthropic,
          google: hasGoogle
        }
      });
    }
  } catch (err) {
    console.error("[Bridge AI IDE] Extension check failed:", err);
    ghostOverlay?.classList.add("visible");
  }
}
