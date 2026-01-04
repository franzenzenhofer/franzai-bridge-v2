/**
 * Bridge AI IDE - State Store
 * Simple pub/sub state management
 */

import type { EditorState, StateKey, StateListener, HistoryEntry, ChatMessage, ContextFile } from "./types";
import { DEFAULT_CODE } from "./types";

const MAX_HISTORY = 50;
const STORAGE_KEY = "bridge_current_project";
const SAVE_DEBOUNCE_MS = 1000;
const PERSIST_KEYS: StateKey[] = [
  "code",
  "previousCode",
  "history",
  "historyIndex",
  "messages",
  "projectName",
  "model",
  "contextFiles"
];

const initialState: EditorState = {
  extension: { ready: false, version: null },
  keys: { openai: false, anthropic: false, google: false },
  view: "preview",
  code: DEFAULT_CODE,
  previousCode: "",
  history: [{ code: DEFAULT_CODE, timestamp: Date.now() }],
  historyIndex: 0,
  model: "gemini-2.5-flash",
  messages: [],
  isStreaming: false,
  logs: [],
  projectName: "Untitled",
  isDirty: false,
  lastSnapshot: null,
  lastRequest: null,
  lastResponse: null,
  contextFiles: []
};

let state: EditorState = { ...initialState };
const listeners: Set<StateListener> = new Set();
let saveTimer: number | null = null;
let allowSave = false;

export function getState(): EditorState {
  return state;
}

export function setState(partial: Partial<EditorState>): void {
  const changedKeys: StateKey[] = [];

  for (const key of Object.keys(partial) as StateKey[]) {
    if (state[key] !== partial[key]) {
      changedKeys.push(key);
    }
  }

  if (changedKeys.length === 0) return;

  state = { ...state, ...partial };

  for (const listener of listeners) {
    listener(state, changedKeys);
  }

  if (changedKeys.some((key) => PERSIST_KEYS.includes(key))) {
    scheduleSave();
  }
}

export function subscribe(listener: StateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateFromLocalStorage(): void {
  if (typeof localStorage === "undefined") {
    allowSave = true;
    return;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    allowSave = true;
    return;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<EditorState>;
    const history = sanitizeHistory(parsed.history, parsed.code);
    const historyIndex = clampHistoryIndex(parsed.historyIndex, history.length);
    const messages = sanitizeMessages(parsed.messages);
    const contextFiles = sanitizeContextFiles(parsed.contextFiles);

    state = {
      ...state,
      code: typeof parsed.code === "string" ? parsed.code : history[historyIndex]?.code ?? state.code,
      previousCode: typeof parsed.previousCode === "string" ? parsed.previousCode : state.previousCode,
      history,
      historyIndex,
      messages,
      projectName: typeof parsed.projectName === "string" ? parsed.projectName : state.projectName,
      model: typeof parsed.model === "string" ? (parsed.model as EditorState["model"]) : state.model,
      contextFiles
    };
  } catch {
    state = { ...initialState };
  } finally {
    allowSave = true;
  }
}

// History management
export function pushHistory(code: string): void {
  const entry: HistoryEntry = { code, timestamp: Date.now() };
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(entry);

  // Prune old entries
  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }

  setState({
    history: newHistory,
    historyIndex: newHistory.length - 1,
    previousCode: state.code,
    code,
    isDirty: true
  });

  updateDocumentTitle(code);
}

export function undo(): boolean {
  if (state.historyIndex <= 0) return false;

  const newIndex = state.historyIndex - 1;
  const entry = state.history[newIndex];
  if (!entry) return false;

  setState({
    historyIndex: newIndex,
    previousCode: state.code,
    code: entry.code
  });

  return true;
}

export function redo(): boolean {
  if (state.historyIndex >= state.history.length - 1) return false;

  const newIndex = state.historyIndex + 1;
  const entry = state.history[newIndex];
  if (!entry) return false;

  setState({
    historyIndex: newIndex,
    previousCode: state.code,
    code: entry.code
  });

  return true;
}

export function canUndo(): boolean {
  return state.historyIndex > 0;
}

export function canRedo(): boolean {
  return state.historyIndex < state.history.length - 1;
}

// Console management
export function addLog(type: "log" | "warn" | "error" | "info", message: string): void {
  const log = { type, message, timestamp: Date.now() };
  const logs = [...state.logs, log].slice(-100); // Keep last 100
  setState({ logs });
}

export function clearLogs(): void {
  setState({ logs: [] });
}

// Chat management
export function addMessage(
  role: "user" | "assistant",
  content: string,
  options?: {
    hasCode?: boolean;
    code?: string;
    changes?: string[];
    isStreaming?: boolean;
    isError?: boolean;
  }
): void {
  const message: ChatMessage = {
    role,
    content,
    timestamp: Date.now(),
    hasCode: options?.hasCode ?? false,
    isStreaming: options?.isStreaming ?? false,
    isError: options?.isError ?? false
  };
  if (options?.code !== undefined) message.code = options.code;
  if (options?.changes !== undefined) message.changes = options.changes;
  setState({ messages: [...state.messages, message] });
}

export function updateLastMessage(
  content: string,
  options?: {
    code?: string;
    changes?: string[];
    isStreaming?: boolean;
    isError?: boolean;
  }
): void {
  if (state.messages.length === 0) return;

  const messages = [...state.messages];
  const last = messages[messages.length - 1];
  if (!last) return;
  messages[messages.length - 1] = {
    ...last,
    content,
    ...(options?.code && { code: options.code, hasCode: true }),
    ...(options?.changes && { changes: options.changes }),
    ...(options?.isStreaming !== undefined && { isStreaming: options.isStreaming }),
    ...(options?.isError !== undefined && { isError: options.isError })
  };
  setState({ messages });
}

function scheduleSave(): void {
  if (!allowSave || typeof localStorage === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistState();
  }, SAVE_DEBOUNCE_MS);
}

function persistState(): void {
  const payload = {
    code: state.code,
    previousCode: state.previousCode,
    history: state.history,
    historyIndex: state.historyIndex,
    messages: state.messages,
    projectName: state.projectName,
    model: state.model,
    contextFiles: state.contextFiles
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors (quota, privacy modes).
  }
}

function sanitizeHistory(value: unknown, fallbackCode?: unknown): HistoryEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    if (typeof fallbackCode === "string" && fallbackCode.trim()) {
      return [{ code: fallbackCode, timestamp: Date.now() }];
    }
    return [...state.history];
  }
  const entries: HistoryEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const code = (entry as { code?: unknown }).code;
    if (typeof code !== "string") continue;
    const timestamp = (entry as { timestamp?: unknown }).timestamp;
    entries.push({
      code,
      timestamp: typeof timestamp === "number" ? timestamp : Date.now()
    });
  }
  return entries.length ? entries.slice(-MAX_HISTORY) : [...state.history];
}

function clampHistoryIndex(value: unknown, length: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return length - 1;
  return Math.min(Math.max(0, Math.floor(value)), Math.max(0, length - 1));
}

function sanitizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: ChatMessage[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const role = (entry as { role?: unknown }).role;
    const content = (entry as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const message: ChatMessage = {
      role,
      content,
      timestamp: typeof (entry as { timestamp?: unknown }).timestamp === "number"
        ? (entry as { timestamp: number }).timestamp
        : Date.now(),
      hasCode: Boolean((entry as { hasCode?: unknown }).hasCode),
      isStreaming: Boolean((entry as { isStreaming?: unknown }).isStreaming),
      isError: Boolean((entry as { isError?: unknown }).isError)
    };
    const code = (entry as { code?: unknown }).code;
    if (typeof code === "string") message.code = code;
    const changes = Array.isArray((entry as { changes?: unknown }).changes)
      ? ((entry as { changes: unknown[] }).changes.filter((c) => typeof c === "string") as string[])
      : undefined;
    if (changes && changes.length) message.changes = changes;
    messages.push(message);
  }
  return messages;
}

function sanitizeContextFiles(value: unknown): ContextFile[] {
  if (!Array.isArray(value)) return [];
  const files: ContextFile[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const id = (entry as { id?: unknown }).id;
    const name = (entry as { name?: unknown }).name;
    const content = (entry as { content?: unknown }).content;
    if (typeof id !== "string" || typeof name !== "string" || typeof content !== "string") continue;
    const updatedAt = (entry as { updatedAt?: unknown }).updatedAt;
    files.push({
      id,
      name,
      content,
      updatedAt: typeof updatedAt === "number" ? updatedAt : Date.now()
    });
  }
  return files;
}

function updateDocumentTitle(code: string): void {
  if (typeof document === "undefined") return;
  const match = code.match(/<title>(.*?)<\/title>/i);
  if (match?.[1]) {
    document.title = `${match[1]} - Bridge`;
  }
}

/** Reset project to initial state and clear localStorage */
export function resetProject(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }

  const fresh: EditorState = {
    ...initialState,
    extension: state.extension,
    keys: state.keys,
    history: [{ code: DEFAULT_CODE, timestamp: Date.now() }],
    historyIndex: 0
  };

  state = fresh;

  for (const listener of listeners) {
    listener(state, PERSIST_KEYS);
  }

  if (typeof document !== "undefined") {
    document.title = "Bridge AI IDE";
  }
}
