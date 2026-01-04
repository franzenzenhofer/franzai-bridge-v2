/**
 * Bridge AI IDE - Editor Pane Component
 * CodeMirror 6 + Preview iframe + Request/Response viewer
 */

import { el } from "../utils/dom";
import { renderJson } from "../utils/json-tree";
import { getState, subscribe, setState, undo, redo, pushHistory } from "../state/store";
import { EditorView } from "codemirror";
import { basicSetup } from "codemirror";
import { html } from "@codemirror/lang-html";
import { indentSelection } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";

let editorView: EditorView | null = null;
let previewFrame: HTMLIFrameElement | null = null;
let previewStage: HTMLDivElement | null = null;
let previewContainer: HTMLDivElement | null = null;
let debounceTimer: number | null = null;

export function initEditorPane(): void {
  const container = document.getElementById("editor-pane");
  if (!container) return;

  render();
  subscribe((state, changed) => {
    if (changed.includes("view")) {
      updateViewVisibility();
    }
    if (changed.includes("code") && !changed.includes("view")) {
      syncCodeToEditor();
      updatePreview();
    }
    if (changed.includes("lastRequest") || changed.includes("lastResponse")) {
      updateRequestPane();
    }
  });
}

function render(): void {
  const container = document.getElementById("editor-pane");
  if (!container) return;

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Header with tabs
  const header = el("div", "editor-pane-header");

  const tabs = el("div", "view-tabs");
  const previewTab = el("button", "view-tab", "Preview");
  const codeTab = el("button", "view-tab", "Code");
  const requestTab = el("button", "view-tab", "Request/Response");

  previewTab.onclick = () => setState({ view: "preview" });
  codeTab.onclick = () => setState({ view: "code" });
  requestTab.onclick = () => setState({ view: "request" });

  tabs.appendChild(previewTab);
  tabs.appendChild(codeTab);
  tabs.appendChild(requestTab);
  header.appendChild(tabs);

  // Actions
  const actions = el("div", "editor-actions");

  const undoBtn = el("button", "editor-btn", "Undo");
  undoBtn.onclick = () => {
    undo();
    pulseCodeContainer();
  };

  const redoBtn = el("button", "editor-btn", "Redo");
  redoBtn.onclick = () => {
    redo();
    pulseCodeContainer();
  };

  const formatBtn = el("button", "editor-btn", "Format");
  formatBtn.onclick = () => formatCode();

  const downloadBtn = el("button", "editor-btn", "Download");
  downloadBtn.onclick = downloadCode;

  const popOutBtn = el("button", "editor-btn", "Pop Out");
  popOutBtn.onclick = openPreviewInNewTab;

  const resetBtn = el("button", "editor-btn", "Kill Preview");
  resetBtn.onclick = resetPreview;

  actions.appendChild(undoBtn);
  actions.appendChild(redoBtn);
  actions.appendChild(formatBtn);
  actions.appendChild(downloadBtn);
  actions.appendChild(popOutBtn);
  actions.appendChild(resetBtn);
  header.appendChild(actions);

  container.appendChild(header);

  // Code container
  const codeContainer = el("div", "code-container");
  codeContainer.id = "code-container";
  container.appendChild(codeContainer);

  // Preview container
  previewContainer = el("div", "preview-container") as HTMLDivElement;
  previewContainer.id = "preview-container";

  const previewToolbar = el("div", "preview-toolbar");

  const reloadBtn = el("button", "device-btn", "↻ Reload");
  reloadBtn.onclick = () => updatePreview();
  previewToolbar.appendChild(reloadBtn);

  previewContainer.appendChild(previewToolbar);

  previewStage = el("div", "preview-stage") as HTMLDivElement;
  previewFrame = el("iframe", "preview-frame") as HTMLIFrameElement;
  previewFrame.sandbox.add("allow-scripts");
  previewFrame.sandbox.add("allow-popups");
  previewFrame.sandbox.add("allow-same-origin");
  previewStage.appendChild(previewFrame);
  previewContainer.appendChild(previewStage);

  container.appendChild(previewContainer);

  // Request container
  const requestContainer = el("div", "request-container");
  requestContainer.id = "request-container";
  container.appendChild(requestContainer);

  // Initialize CodeMirror
  initCodeMirror();
  updateViewVisibility();
  updatePreview();
  updateRequestPane();
}

function initCodeMirror(): void {
  const container = document.getElementById("code-container");
  if (!container) return;

  const state = getState();

  editorView = new EditorView({
    doc: state.code,
    extensions: [
      basicSetup,
      html(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newCode = update.state.doc.toString();
          debouncedUpdate(newCode);
        }
      })
    ],
    parent: container
  });
}

function debouncedUpdate(code: string): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    pushHistory(code);
    updatePreview();
  }, 500);
}

function syncCodeToEditor(): void {
  if (!editorView) return;
  const state = getState();
  const currentDoc = editorView.state.doc.toString();
  if (currentDoc !== state.code) {
    editorView.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: state.code }
    });
  }
}

function updateViewVisibility(): void {
  const state = getState();
  const codeContainer = document.getElementById("code-container");
  const previewContainerEl = document.getElementById("preview-container");
  const requestContainer = document.getElementById("request-container");
  const tabs = document.querySelectorAll(".view-tab");

  codeContainer?.classList.remove("visible");
  previewContainerEl?.classList.remove("visible");
  requestContainer?.classList.remove("visible");
  tabs.forEach(t => t.classList.remove("active"));

  if (state.view === "code") {
    codeContainer?.classList.add("visible");
    tabs[1]?.classList.add("active");
  } else if (state.view === "request") {
    requestContainer?.classList.add("visible");
    tabs[2]?.classList.add("active");
  } else {
    previewContainerEl?.classList.add("visible");
    tabs[0]?.classList.add("active");
  }
}

function updatePreview(): void {
  if (!previewFrame || !previewContainer) return;
  const state = getState();

  const consoleCapture = buildConsoleCapture();
  const headCloseIndex = state.code.indexOf("</head>");
  let codeWithCapture: string;
  if (headCloseIndex !== -1) {
    codeWithCapture = state.code.slice(0, headCloseIndex) + consoleCapture + state.code.slice(headCloseIndex);
  } else {
    codeWithCapture = consoleCapture + state.code;
  }

  previewContainer.classList.remove("updating");
  void previewContainer.offsetWidth;
  previewContainer.classList.add("updating");
  window.setTimeout(() => previewContainer?.classList.remove("updating"), 320);

  previewFrame.srcdoc = codeWithCapture;
}

function buildConsoleCapture(): string {
  return `<script>
(function() {
  var orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  var serialize = function(a) { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return '[Unserializable]'; } };
  var hudId = 'bridge-error-hud';

  function showHud(message) {
    var existing = document.getElementById(hudId);
    if (existing) existing.remove();
    var hud = document.createElement('div');
    hud.id = hudId;
    hud.style.cssText = 'position:fixed; bottom:12px; right:12px; background:#d93025; color:white; padding:10px 12px; border-radius:6px; font-family:sans-serif; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:12px; max-width:320px; display:flex; gap:8px; align-items:flex-start;';
    var text = document.createElement('div');
    text.textContent = 'Runtime Error: ' + message;
    var close = document.createElement('button');
    close.textContent = 'x';
    close.style.cssText = 'background:none; border:none; color:white; cursor:pointer; font-weight:bold; padding:0; line-height:1;';
    close.onclick = function() { hud.remove(); };
    hud.appendChild(text);
    hud.appendChild(close);
    document.body.appendChild(hud);
  }

  ['log', 'warn', 'error', 'info'].forEach(function(m) {
    console[m] = function() {
      var args = Array.prototype.slice.call(arguments);
      window.parent.postMessage({ type: 'console', method: m, args: args.map(serialize) }, '*');
      orig[m].apply(console, args);
    };
  });

  window.onerror = function(msg, url, line) {
    window.parent.postMessage({ type: 'console', method: 'error', args: [msg + ' (line ' + line + ')'] }, '*');
    showHud(msg);
  };

  window.onunhandledrejection = function(event) {
    var reason = event && event.reason ? event.reason : 'Unhandled rejection';
    showHud(serialize(reason));
  };

  document.addEventListener('click', function(event) {
    var target = event.target;
    if (!target) return;
    var link = target.closest ? target.closest('a') : null;
    if (!link || !link.href) return;
    if (link.target && link.target !== '_self') return;
    event.preventDefault();
    window.open(link.href, '_blank');
  }, true);
})();
</script>`;
}

function updateRequestPane(): void {
  const container = document.getElementById("request-container");
  if (!container) return;

  const state = getState();

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (!state.lastRequest && !state.lastResponse) {
    const empty = el("div", "request-empty");
    empty.textContent = "No API request yet. Send a message to see the request/response.";
    container.appendChild(empty);
    return;
  }

  if (state.lastRequest) {
    const reqSection = el("div", "request-section");
    const reqHeader = el("div", "request-section-header", "Request");
    reqSection.appendChild(reqHeader);

    const reqMeta = el("div", "request-meta");
    reqMeta.appendChild(el("span", "req-method", state.lastRequest.method));
    reqMeta.appendChild(document.createTextNode(" "));
    reqMeta.appendChild(el("span", "req-url", state.lastRequest.url));
    reqSection.appendChild(reqMeta);

    const reqBody = el("div", "request-body");
    reqBody.appendChild(renderJson(state.lastRequest.body, 2));
    reqSection.appendChild(reqBody);

    container.appendChild(reqSection);
  }

  if (state.lastResponse) {
    const resSection = el("div", "response-section");
    const resHeader = el("div", "request-section-header", "Response");
    resSection.appendChild(resHeader);

    const resMeta = el("div", "response-meta");
    const statusClass = state.lastResponse.status < 400 ? "status-ok" : "status-error";
    const statusEl = el("span", `res-status ${statusClass}`);
    statusEl.textContent = `${state.lastResponse.status} ${state.lastResponse.statusText}`;
    resMeta.appendChild(statusEl);
    resMeta.appendChild(document.createTextNode(" "));
    resMeta.appendChild(el("span", "res-duration", `${state.lastResponse.duration}ms`));
    resSection.appendChild(resMeta);

    if (state.lastResponse.error) {
      resSection.appendChild(el("div", "response-error", state.lastResponse.error));
    }

    const resBody = el("div", "response-body");
    resBody.appendChild(renderJson(state.lastResponse.body, 2));
    resSection.appendChild(resBody);

    container.appendChild(resSection);
  }
}

function downloadCode(): void {
  const state = getState();
  const blob = new Blob([state.code], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${state.projectName.toLowerCase().replace(/\s+/g, "-")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function openPreviewInNewTab(): void {
  const state = getState();
  const blob = new Blob([state.code], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function resetPreview(): void {
  if (!previewFrame) return;
  previewFrame.srcdoc = "<!DOCTYPE html><html><head></head><body></body></html>";
}

function formatCode(): void {
  if (!editorView) return;
  const selection = editorView.state.selection;
  const length = editorView.state.doc.length;

  editorView.dispatch({ selection: EditorSelection.single(0, length) });
  indentSelection(editorView);
  editorView.dispatch({ selection });
}

function pulseCodeContainer(): void {
  const container = document.getElementById("code-container");
  if (!container) return;
  container.classList.remove("flash");
  void container.offsetWidth;
  container.classList.add("flash");
}

export function getPreviewFrame(): HTMLIFrameElement | null {
  return previewFrame;
}
