/**
 * Bridge AI IDE - Chat Pane Component
 */

import { el } from "../utils/dom";
import { getState, subscribe, setState, addMessage, updateLastMessage, pushHistory } from "../state/store";
import { streamChat, extractCodeBlock } from "../services/ai-client";
import { buildSystemPrompt } from "../services/ai-context";
import type { ChatMessage, ModelId } from "../state/types";

export function initChatPane(): void {
  const container = document.getElementById("chat-pane");
  if (!container) return;

  render();
  subscribe((state, changed) => {
    if (changed.includes("messages") || changed.includes("isStreaming") || changed.includes("model") || changed.includes("keys")) {
      render();
    }
  });
}

function render(): void {
  const container = document.getElementById("chat-pane");
  if (!container) return;

  const state = getState();

  // Clear using DOM method
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Header
  const header = el("div", "chat-header");
  header.appendChild(el("span", "chat-title", "AI Assistant"));

  const modelSelect = el("select", "model-select") as HTMLSelectElement;
  const allModels: { id: ModelId; label: string; keyName: "openai" | "anthropic" | "google" }[] = [
    { id: "gpt-5-mini", label: "GPT-5 Mini", keyName: "openai" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", keyName: "anthropic" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", keyName: "google" }
  ];

  // Show all models, but disable ones without API keys
  for (const m of allModels) {
    const opt = el("option") as HTMLOptionElement;
    opt.value = m.id;
    const hasKey = state.keys[m.keyName];
    opt.textContent = hasKey ? m.label : `${m.label} (no key)`;
    opt.disabled = !hasKey;
    if (m.id === state.model && hasKey) opt.selected = true;
    modelSelect.appendChild(opt);
  }

  // If current model is not available, switch to first available
  const availableModels = allModels.filter(m => state.keys[m.keyName]);
  if (availableModels.length > 0 && !availableModels.find(m => m.id === state.model)) {
    setState({ model: availableModels[0].id });
  }

  modelSelect.onchange = () => setState({ model: modelSelect.value as ModelId });
  header.appendChild(modelSelect);
  container.appendChild(header);

  // Messages list
  const messagesList = el("div", "messages-list");

  if (state.messages.length === 0) {
    const welcome = el("div", "message assistant");
    const content = el("div", "message-content");
    content.textContent = "Hi! I'm your AI coding assistant. Tell me what you'd like to build, and I'll help you create it using the Bridge extension for API access.";
    welcome.appendChild(content);
    messagesList.appendChild(welcome);
  } else {
    for (const msg of state.messages) {
      messagesList.appendChild(renderMessage(msg));
    }
  }

  // Streaming indicator
  if (state.isStreaming) {
    const indicator = el("div", "streaming-indicator");
    for (let i = 0; i < 3; i++) {
      indicator.appendChild(el("span", "streaming-dot"));
    }
    messagesList.appendChild(indicator);
  }

  container.appendChild(messagesList);

  // Scroll to bottom
  requestAnimationFrame(() => {
    messagesList.scrollTop = messagesList.scrollHeight;
  });

  // Input area
  const inputArea = el("div", "chat-input-area");
  const inputWrapper = el("div", "chat-input-wrapper");

  const input = el("textarea", "chat-input") as HTMLTextAreaElement;
  input.placeholder = "Describe what you want to build...";
  input.disabled = state.isStreaming;

  input.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
      input.value = "";
    }
  };

  const sendBtn = el("button", "chat-send-btn", "Send");
  sendBtn.disabled = state.isStreaming;
  sendBtn.onclick = () => {
    sendMessage(input.value);
    input.value = "";
  };

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(sendBtn);
  inputArea.appendChild(inputWrapper);
  container.appendChild(inputArea);

  // Actions bar
  const actionsBar = el("div", "chat-actions");

  const newBtn = el("button", "chat-action-btn", "New Chat");
  newBtn.onclick = () => setState({ messages: [] });

  actionsBar.appendChild(newBtn);
  container.appendChild(actionsBar);
}

function renderMessage(msg: ChatMessage): HTMLElement {
  const wrapper = el("div", `message ${msg.role}`);

  const header = el("div", "message-header");
  const role = el("span", "message-role", msg.role === "user" ? "You" : "AI");
  header.appendChild(role);
  wrapper.appendChild(header);

  const content = el("div", "message-content");
  // Simple text rendering - no markdown for now to avoid XSS
  content.textContent = msg.content;
  wrapper.appendChild(content);

  return wrapper;
}

async function sendMessage(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const state = getState();
  if (state.isStreaming) return;

  // Add user message
  addMessage("user", trimmed);

  // Switch to code view for streaming
  setState({ view: "code", isStreaming: true });

  // Add empty assistant message that will be updated
  addMessage("assistant", "", false);

  try {
    const systemPrompt = buildSystemPrompt();
    const messages = getState().messages.slice(0, -1); // Exclude the empty assistant message

    let fullResponse = "";

    await streamChat(
      state.model,
      messages,
      systemPrompt,
      (chunk) => {
        fullResponse += chunk;
        updateLastMessage(fullResponse);

        // Try to extract and apply code block as it streams
        const code = extractCodeBlock(fullResponse);
        if (code) {
          pushHistory(code);
        }
      },
      () => {
        setState({ isStreaming: false, view: "preview" });

        // Final code extraction
        const code = extractCodeBlock(fullResponse);
        if (code) {
          pushHistory(code);
        }
      }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    updateLastMessage(`Error: ${errorMsg}`);
    setState({ isStreaming: false });
  }
}
