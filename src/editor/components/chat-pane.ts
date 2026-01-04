/**
 * Bridge AI IDE - Chat Pane Component
 * Displays structured AI responses with explanation + collapsible code
 */

import { el } from "../utils/dom";
import { renderMarkdown } from "../utils/markdown-renderer";
import { getState, subscribe, setState, addMessage, updateLastMessage, pushHistory } from "../state/store";
import { streamingChat } from "../services/ai-client";
import { buildSystemPrompt } from "../services/ai-context";
import type { ChatMessage, ModelId, ContextFile } from "../state/types";
import { SUGGESTIONS } from "../data/templates";
import { makeId } from "../../shared/ids";

let activeAbortController: AbortController | null = null;
let promptHistory: string[] = [];
let promptIndex = -1;
let lastRenderedCount = 0;
let contextDraft: { id?: string; name: string; content: string } | null = null;
let initialPromptHandled = false;

export function initChatPane(): void {
  const container = document.getElementById("chat-pane");
  if (!container) return;

  render();
  subscribe((state, changed) => {
    if (changed.includes("messages") || changed.includes("isStreaming") || changed.includes("model") || changed.includes("keys") || changed.includes("contextFiles")) {
      render();
    }
  });

  if (!initialPromptHandled) {
    const prompt = new URLSearchParams(window.location.search).get("prompt");
    if (prompt) {
      initialPromptHandled = true;
      sendMessage(prompt);
    }
  }
}

function render(): void {
  const container = document.getElementById("chat-pane");
  if (!container) return;

  const previousList = container.querySelector(".messages-list") as HTMLDivElement | null;
  const prevScrollTop = previousList?.scrollTop ?? 0;
  const wasAtBottom = previousList
    ? previousList.scrollTop + previousList.clientHeight >= previousList.scrollHeight - 8
    : true;

  const state = getState();

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Header
  const header = el("div", "chat-header");
  header.appendChild(el("span", "chat-title", "AI Assistant"));

  const modelSelect = el("select", "model-select") as HTMLSelectElement;
  const allModels: { id: ModelId; label: string; keyName: "openai" | "anthropic" | "google" }[] = [
    { id: "gpt-5-mini", label: "GPT-4o Mini", keyName: "openai" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", keyName: "anthropic" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", keyName: "google" }
  ];

  for (const m of allModels) {
    const opt = el("option") as HTMLOptionElement;
    opt.value = m.id;
    const hasKey = state.keys[m.keyName];
    opt.textContent = hasKey ? m.label : `${m.label} (no key)`;
    opt.disabled = !hasKey;
    if (m.id === state.model && hasKey) opt.selected = true;
    modelSelect.appendChild(opt);
  }

  const availableModels = allModels.filter(m => state.keys[m.keyName]);
  const firstAvailable = availableModels[0];
  if (firstAvailable && !availableModels.find(m => m.id === state.model)) {
    setState({ model: firstAvailable.id });
  }

  modelSelect.onchange = () => setState({ model: modelSelect.value as ModelId });
  header.appendChild(modelSelect);
  container.appendChild(header);

  // Messages list
  const messagesList = el("div", "messages-list");

  if (state.messages.length === 0) {
    const welcome = el("div", "message assistant");
    const content = el("div", "message-content");
    content.textContent = "Hi! I'm your AI coding assistant. Tell me what you'd like to build, and I'll create it for you. I have full knowledge of the Bridge API and can build apps with AI integrations.";
    welcome.appendChild(content);
    messagesList.appendChild(welcome);

    const suggestionWrap = renderSuggestions();
    if (suggestionWrap) messagesList.appendChild(suggestionWrap);
  } else {
    const animateIndex = state.messages.length > lastRenderedCount ? state.messages.length - 1 : -1;
    state.messages.forEach((msg, index) => {
      messagesList.appendChild(renderMessage(msg, index === animateIndex));
    });
  }

  container.appendChild(messagesList);

  lastRenderedCount = state.messages.length;

  requestAnimationFrame(() => {
    if (state.isStreaming) {
      messagesList.scrollTop = messagesList.scrollHeight;
      return;
    }
    if (wasAtBottom) {
      messagesList.scrollTop = messagesList.scrollHeight;
    } else {
      messagesList.scrollTop = Math.min(prevScrollTop, messagesList.scrollHeight);
    }
  });

  // Context section
  container.appendChild(renderContextSection(state.contextFiles));

  // Input area
  const inputArea = el("div", "chat-input-area");
  const inputWrapper = el("div", "chat-input-wrapper");

  const input = el("textarea", "chat-input") as HTMLTextAreaElement;
  input.placeholder = "Describe what you want to build...";
  input.disabled = state.isStreaming;

  input.onkeydown = (e) => {
    if (handleHistoryKey(e, input)) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const value = input.value;
      input.value = "";
      sendMessage(value);
    }
  };

  const sendBtn = el("button", "chat-send-btn", "Send");
  sendBtn.disabled = state.isStreaming;
  sendBtn.onclick = () => {
    const value = input.value;
    input.value = "";
    sendMessage(value);
  };

  const stopBtn = el("button", "chat-stop-btn", "Stop");
  stopBtn.disabled = !state.isStreaming;
  stopBtn.onclick = () => stopGeneration();

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(sendBtn);
  inputWrapper.appendChild(stopBtn);
  inputArea.appendChild(inputWrapper);
  container.appendChild(inputArea);

  // Actions bar
  const actionsBar = el("div", "chat-actions");
  const newBtn = el("button", "chat-action-btn", "New Chat");
  newBtn.onclick = () => {
    promptHistory = [];
    promptIndex = -1;
    activeAbortController = null;
    setState({ messages: [] });
  };
  actionsBar.appendChild(newBtn);
  container.appendChild(actionsBar);
}

function renderSuggestions(): HTMLElement | null {
  if (!SUGGESTIONS.length) return null;
  const wrapper = el("div", "chat-suggestions");
  const label = el("div", "chat-suggestions-label", "Try one:");
  wrapper.appendChild(label);

  const list = el("div", "chat-suggestions-list");
  for (const suggestion of SUGGESTIONS) {
    const chip = el("button", "chat-suggestion", suggestion);
    chip.onclick = () => sendMessage(suggestion);
    list.appendChild(chip);
  }
  wrapper.appendChild(list);
  return wrapper;
}

function renderMessage(msg: ChatMessage, shouldAnimate: boolean): HTMLElement {
  const wrapper = el("div", `message ${msg.role}`);
  if (shouldAnimate) wrapper.dataset.animate = "true";
  if (msg.isStreaming) wrapper.classList.add("streaming");

  const header = el("div", "message-header");
  header.appendChild(el("span", "message-role", msg.role === "user" ? "You" : "AI"));
  wrapper.appendChild(header);

  const content = el("div", "message-content");
  if (msg.role === "assistant") {
    if (!msg.content && msg.isStreaming) {
      content.appendChild(renderSkeleton());
    } else {
      content.appendChild(renderMarkdown(msg.content));
    }
  } else {
    content.textContent = msg.content;
  }

  if (msg.isStreaming) {
    const cursor = el("span", "typing-cursor", "|");
    content.appendChild(cursor);
  }

  if (msg.isError) {
    content.classList.add("message-error");
  }

  wrapper.appendChild(content);

  // Show collapsible code preview for assistant messages with code
  if (msg.role === "assistant" && msg.code) {
    const codeSection = el("div", "message-code-section");

    // Changes list if available
    if (msg.changes && msg.changes.length > 0) {
      const changesList = el("ul", "message-changes");
      for (const change of msg.changes) {
        const li = el("li", "", change);
        changesList.appendChild(li);
      }
      codeSection.appendChild(changesList);
    }

    const codeActions = el("div", "code-actions");
    const codeToggle = el("button", "code-toggle");
    codeToggle.textContent = "View Code";
    let expanded = false;

    const copyBtn = el("button", "code-copy-btn", "Copy Code");
    copyBtn.onclick = () => copyToClipboard(msg.code ?? "", copyBtn);

    const codePreview = el("pre", "code-preview");
    codePreview.style.display = "none";
    codePreview.textContent = msg.code.slice(0, 500) + (msg.code.length > 500 ? "\n..." : "");

    codeToggle.onclick = () => {
      expanded = !expanded;
      codeToggle.textContent = expanded ? "Hide Code" : "View Code";
      codePreview.style.display = expanded ? "block" : "none";
    };

    codeActions.appendChild(codeToggle);
    codeActions.appendChild(copyBtn);
    codeSection.appendChild(codeActions);
    codeSection.appendChild(codePreview);
    wrapper.appendChild(codeSection);

    const badge = el("div", "applied-badge", "Applied to Preview");
    wrapper.appendChild(badge);
  }

  return wrapper;
}

function renderSkeleton(): HTMLElement {
  const wrap = el("div", "typing-dots");
  for (let i = 0; i < 3; i += 1) {
    wrap.appendChild(el("span", "typing-dot"));
  }
  return wrap;
}

function handleHistoryKey(event: KeyboardEvent, input: HTMLTextAreaElement): boolean {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return false;
  if (!promptHistory.length) return false;

  const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
  const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;

  if (event.key === "ArrowUp" && atStart) {
    event.preventDefault();
    if (promptIndex < 0) promptIndex = promptHistory.length;
    promptIndex = Math.max(0, promptIndex - 1);
    input.value = promptHistory[promptIndex] ?? "";
    input.setSelectionRange(input.value.length, input.value.length);
    return true;
  }

  if (event.key === "ArrowDown" && atEnd) {
    event.preventDefault();
    if (promptIndex < 0) return false;
    promptIndex = Math.min(promptHistory.length, promptIndex + 1);
    input.value = promptIndex >= promptHistory.length ? "" : promptHistory[promptIndex] ?? "";
    input.setSelectionRange(input.value.length, input.value.length);
    return true;
  }

  return false;
}

function recordPrompt(text: string): void {
  if (!text.trim()) return;
  if (promptHistory[promptHistory.length - 1] !== text) {
    promptHistory.push(text);
  }
  promptIndex = -1;
}

function stopGeneration(): void {
  if (!activeAbortController) return;
  activeAbortController.abort();
  activeAbortController = null;
  updateLastMessage("Generation stopped.", { isStreaming: false, isError: true });
  setState({ isStreaming: false });
}

function renderContextSection(contextFiles: ContextFile[]): HTMLElement {
  const section = el("div", "context-section");
  const header = el("div", "context-header");
  header.appendChild(el("span", "context-title", "Project Context"));

  const addBtn = el("button", "context-add-btn", "Add Context");
  addBtn.onclick = () => openContextEditor();
  header.appendChild(addBtn);
  section.appendChild(header);

  const list = el("div", "context-list");
  if (contextFiles.length === 0) {
    list.appendChild(el("div", "context-empty", "Add notes, data, or specs to improve responses."));
  } else {
    for (const ctx of contextFiles) {
      list.appendChild(renderContextItem(ctx));
    }
  }
  section.appendChild(list);

  if (contextDraft) {
    section.appendChild(renderContextEditor());
  }

  return section;
}

function renderContextItem(ctx: ContextFile): HTMLElement {
  const row = el("div", "context-item");
  const meta = el("div", "context-meta");
  meta.appendChild(el("div", "context-name", ctx.name));
  meta.appendChild(el("div", "context-updated", new Date(ctx.updatedAt).toLocaleString()));

  const actions = el("div", "context-actions");
  const editBtn = el("button", "context-edit-btn", "Edit");
  editBtn.onclick = () => openContextEditor(ctx);
  const removeBtn = el("button", "context-remove-btn", "Remove");
  removeBtn.onclick = () => removeContextFile(ctx.id);
  actions.appendChild(editBtn);
  actions.appendChild(removeBtn);

  row.appendChild(meta);
  row.appendChild(actions);
  return row;
}

function renderContextEditor(): HTMLElement {
  if (!contextDraft) return el("div");
  const editor = el("div", "context-editor");

  const nameInput = el("input", "context-input") as HTMLInputElement;
  nameInput.placeholder = "Context name (e.g. Pricing JSON)";
  nameInput.value = contextDraft.name;
  nameInput.oninput = () => {
    if (!contextDraft) return;
    contextDraft.name = nameInput.value;
  };

  const contentInput = el("textarea", "context-textarea") as HTMLTextAreaElement;
  contentInput.placeholder = "Paste text or JSON...";
  contentInput.value = contextDraft.content;
  contentInput.oninput = () => {
    if (!contextDraft) return;
    contextDraft.content = contentInput.value;
  };

  const actions = el("div", "context-editor-actions");
  const saveBtn = el("button", "context-save-btn", "Save");
  saveBtn.onclick = () => saveContextDraft();
  const cancelBtn = el("button", "context-cancel-btn", "Cancel");
  cancelBtn.onclick = () => cancelContextDraft();

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  editor.appendChild(nameInput);
  editor.appendChild(contentInput);
  editor.appendChild(actions);
  return editor;
}

function openContextEditor(existing?: ContextFile): void {
  contextDraft = existing
    ? { id: existing.id, name: existing.name, content: existing.content }
    : { name: "", content: "" };
  render();
}

function cancelContextDraft(): void {
  contextDraft = null;
  render();
}

function saveContextDraft(): void {
  if (!contextDraft) return;
  const name = contextDraft.name.trim();
  const content = contextDraft.content.trim();
  if (!name || !content) {
    return;
  }

  const state = getState();
  const updatedAt = Date.now();

  if (contextDraft.id) {
    const updated = state.contextFiles.map((ctx) =>
      ctx.id === contextDraft?.id ? { ...ctx, name, content, updatedAt } : ctx
    );
    setState({ contextFiles: updated });
  } else {
    const newFile: ContextFile = { id: makeId("ctx"), name, content, updatedAt };
    setState({ contextFiles: [...state.contextFiles, newFile] });
  }

  contextDraft = null;
  render();
}

function removeContextFile(id: string): void {
  const state = getState();
  setState({ contextFiles: state.contextFiles.filter((ctx) => ctx.id !== id) });
}

function copyToClipboard(text: string, button: HTMLElement): void {
  if (!text.trim()) return;
  const restore = () => {
    button.textContent = "Copy Code";
    button.classList.remove("copied");
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      button.textContent = "Copied";
      button.classList.add("copied");
      window.setTimeout(restore, 1500);
    }).catch(restore);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    button.textContent = "Copied";
    button.classList.add("copied");
    window.setTimeout(restore, 1500);
  } finally {
    document.body.removeChild(textarea);
  }
}

async function sendMessage(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const state = getState();
  if (state.isStreaming) return;

  recordPrompt(trimmed);
  addMessage("user", trimmed);
  const messagesForAI = getState().messages;
  addMessage("assistant", "", { isStreaming: true });
  setState({ isStreaming: true });

  activeAbortController = new AbortController();

  try {
    const systemPrompt = buildSystemPrompt();

    // Use streaming chat with progressive UI updates
    const result = await streamingChat(state.model, messagesForAI, systemPrompt, {
      signal: activeAbortController.signal,
      onChunk: (accumulatedText) => {
        // Show streaming progress - try to extract explanation preview
        const preview = extractStreamingPreview(accumulatedText);
        updateLastMessage(preview, { isStreaming: true });
      },
      onDone: () => {
        // Streaming complete, final parse will happen below
      }
    });

    const updateOptions: { code?: string; changes?: string[]; isStreaming?: boolean } = {
      code: result.code,
      isStreaming: false
    };
    if (result.changes && result.changes.length) {
      updateOptions.changes = result.changes;
    }
    updateLastMessage(result.explanation, updateOptions);

    pushHistory(result.code);
    setState({ isStreaming: false, view: "preview" });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    if (!isAbort) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      updateLastMessage(`Error: ${errorMsg}`, { isStreaming: false, isError: true });
    }
    setState({ isStreaming: false });
  } finally {
    activeAbortController = null;
  }
}

/** Extract preview text from streaming JSON - shows explanation as it builds */
function extractStreamingPreview(text: string): string {
  // Try to extract partial explanation from streaming JSON
  // Format: {"explanation":"...","code":"..."}
  const explanationMatch = text.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);
  if (explanationMatch?.[1]) {
    // Unescape JSON string
    try {
      return JSON.parse(`"${explanationMatch[1]}"`);
    } catch {
      return explanationMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
  }
  // Fallback: show character count
  return `Generating... (${text.length} chars)`;
}
