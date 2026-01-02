// Google Account section for sidepanel settings
// Modular component for Google OAuth management

import type { GooglePublicAuthState } from "../shared/types";
import { BG_MSG, BG_EVT } from "../shared/messages";
import { sendRuntimeMessage } from "../shared/runtime";

let authState: GooglePublicAuthState = { authenticated: false, email: null, scopes: [] };
let container: HTMLElement | null = null;

const SCOPES = {
  webmasters: { url: "https://www.googleapis.com/auth/webmasters.readonly", name: "Search Console" },
  analytics: { url: "https://www.googleapis.com/auth/analytics.readonly", name: "Analytics" }
};

function hasScope(scopeUrl: string): boolean {
  return authState.scopes.some(s => s === scopeUrl || s.includes(scopeUrl.split("/").pop() || ""));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

async function refreshState(): Promise<void> {
  try {
    const resp = await sendRuntimeMessage<
      { type: typeof BG_MSG.GOOGLE_GET_STATE },
      { ok: boolean; state: GooglePublicAuthState }
    >({ type: BG_MSG.GOOGLE_GET_STATE });
    if (resp.ok && resp.state) {
      authState = resp.state;
    }
  } catch (e) {
    console.error("[GoogleAccount] Failed to get state:", e);
  }
}

async function signIn(): Promise<void> {
  try {
    await sendRuntimeMessage<
      { type: typeof BG_MSG.GOOGLE_AUTH; payload: { scopes: string[] } },
      { ok: boolean }
    >({ type: BG_MSG.GOOGLE_AUTH, payload: { scopes: [SCOPES.webmasters.url] } });
    await refreshState();
    render();
  } catch (e) {
    console.error("[GoogleAccount] Sign in failed:", e);
  }
}

async function signOut(): Promise<void> {
  try {
    await sendRuntimeMessage<{ type: typeof BG_MSG.GOOGLE_LOGOUT }, { ok: boolean }>({
      type: BG_MSG.GOOGLE_LOGOUT
    });
    authState = { authenticated: false, email: null, scopes: [] };
    render();
  } catch (e) {
    console.error("[GoogleAccount] Sign out failed:", e);
  }
}

function render(): void {
  if (!container) return;
  container.textContent = "";

  // Header
  const header = el("div", "settings-section-title", "Google Account");
  container.appendChild(header);

  // Status row
  const statusRow = el("div", "google-status-row");
  const dot = el("span", authState.authenticated ? "google-dot connected" : "google-dot");
  statusRow.appendChild(dot);

  if (authState.authenticated) {
    statusRow.appendChild(el("span", "google-email", authState.email || "Connected"));
  } else {
    statusRow.appendChild(el("span", "google-not-connected", "Not connected"));
  }
  container.appendChild(statusRow);

  if (!authState.authenticated) {
    // Connect button
    const desc = el("div", "google-desc", "Connect to use Search Console & Analytics APIs");
    container.appendChild(desc);

    const btn = el("button", "settings-btn google-connect-btn", "Connect Google Account");
    btn.onclick = signIn;
    container.appendChild(btn);
  } else {
    // Scopes display
    const scopesRow = el("div", "google-scopes-row");
    Object.entries(SCOPES).forEach(([, scope]) => {
      const badge = el("span", hasScope(scope.url) ? "google-scope-badge granted" : "google-scope-badge");
      badge.textContent = (hasScope(scope.url) ? "\u2713 " : "\u2717 ") + scope.name;
      scopesRow.appendChild(badge);
    });
    container.appendChild(scopesRow);

    // Disconnect button
    const btn = el("button", "settings-btn google-disconnect-btn", "Disconnect");
    btn.onclick = signOut;
    container.appendChild(btn);
  }
}

export async function initGoogleAccount(containerEl: HTMLElement): Promise<void> {
  container = containerEl;
  await refreshState();
  render();
}

export function renderGoogleAccount(): void {
  render();
}

// Listen for auth updates from background
chrome.runtime.onMessage.addListener((msg: { type: string }) => {
  if (msg.type === BG_EVT.GOOGLE_AUTH_UPDATED) {
    refreshState().then(render);
  }
});
