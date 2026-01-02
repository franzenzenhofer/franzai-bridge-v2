/**
 * Bridge AI IDE - Editor Pane Component
 * CodeMirror 6 + Preview iframe
 */

import { el } from "../utils/dom";
import { getState, subscribe, setState, undo, redo, pushHistory } from "../state/store";
import { EditorView, basicSetup } from "codemirror";
import { html } from "@codemirror/lang-html";

let editorView: EditorView | null = null;
let previewFrame: HTMLIFrameElement | null = null;
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
  });
}

function render(): void {
  const container = document.getElementById("editor-pane");
  if (!container) return;

  // Clear using DOM method
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Header with tabs
  const header = el("div", "editor-pane-header");

  const tabs = el("div", "view-tabs");
  const previewTab = el("button", "view-tab", "Preview");
  const codeTab = el("button", "view-tab", "Code");

  previewTab.onclick = () => setState({ view: "preview" });
  codeTab.onclick = () => setState({ view: "code" });

  tabs.appendChild(previewTab);
  tabs.appendChild(codeTab);
  header.appendChild(tabs);

  // Actions
  const actions = el("div", "editor-actions");

  const undoBtn = el("button", "editor-btn", "Undo");
  undoBtn.onclick = () => undo();

  const redoBtn = el("button", "editor-btn", "Redo");
  redoBtn.onclick = () => redo();

  const downloadBtn = el("button", "editor-btn", "Download");
  downloadBtn.onclick = downloadCode;

  actions.appendChild(undoBtn);
  actions.appendChild(redoBtn);
  actions.appendChild(downloadBtn);
  header.appendChild(actions);

  container.appendChild(header);

  // Code container
  const codeContainer = el("div", "code-container");
  codeContainer.id = "code-container";
  container.appendChild(codeContainer);

  // Preview container
  const previewContainer = el("div", "preview-container");
  previewContainer.id = "preview-container";

  previewFrame = el("iframe", "preview-frame") as HTMLIFrameElement;
  previewFrame.sandbox.add("allow-scripts");
  previewContainer.appendChild(previewFrame);
  container.appendChild(previewContainer);

  // Initialize CodeMirror
  initCodeMirror();
  updateViewVisibility();
  updatePreview();
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
  const previewContainer = document.getElementById("preview-container");
  const tabs = document.querySelectorAll(".view-tab");

  if (state.view === "code") {
    codeContainer?.classList.add("visible");
    previewContainer?.classList.remove("visible");
    tabs[0]?.classList.remove("active");
    tabs[1]?.classList.add("active");
  } else {
    codeContainer?.classList.remove("visible");
    previewContainer?.classList.add("visible");
    tabs[0]?.classList.add("active");
    tabs[1]?.classList.remove("active");
  }
}

function updatePreview(): void {
  if (!previewFrame) return;
  const state = getState();

  // Build console capture script
  const consoleCapture = buildConsoleCapture();

  // Insert before </head>
  const headCloseIndex = state.code.indexOf("</head>");
  let codeWithCapture: string;
  if (headCloseIndex !== -1) {
    codeWithCapture = state.code.slice(0, headCloseIndex) + consoleCapture + state.code.slice(headCloseIndex);
  } else {
    codeWithCapture = consoleCapture + state.code;
  }

  previewFrame.srcdoc = codeWithCapture;
}

function buildConsoleCapture(): string {
  return `<script>
(function() {
  var orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  var serialize = function(a) { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return '[Unserializable]'; } };
  ['log', 'warn', 'error', 'info'].forEach(function(m) {
    console[m] = function() {
      var args = Array.prototype.slice.call(arguments);
      window.parent.postMessage({ type: 'console', method: m, args: args.map(serialize) }, '*');
      orig[m].apply(console, args);
    };
  });
  window.onerror = function(msg, url, line) {
    window.parent.postMessage({ type: 'console', method: 'error', args: [msg + ' (line ' + line + ')'] }, '*');
  };
})();
</script>`;
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

export function getPreviewFrame(): HTMLIFrameElement | null {
  return previewFrame;
}
