/**
 * Bridge AI IDE - State Store
 * Simple pub/sub state management
 */

import type { EditorState, StateKey, StateListener, HistoryEntry } from "./types";
import { DEFAULT_CODE } from "./types";

const MAX_HISTORY = 50;

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
  lastSnapshot: null
};

let state: EditorState = { ...initialState };
const listeners: Set<StateListener> = new Set();

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
}

export function subscribe(listener: StateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
}

export function undo(): boolean {
  if (state.historyIndex <= 0) return false;

  const newIndex = state.historyIndex - 1;
  const entry = state.history[newIndex];

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
export function addMessage(role: "user" | "assistant", content: string, hasCode = false): void {
  const message = { role, content, timestamp: Date.now(), hasCode };
  setState({ messages: [...state.messages, message] });
}

export function updateLastMessage(content: string): void {
  if (state.messages.length === 0) return;

  const messages = [...state.messages];
  messages[messages.length - 1] = {
    ...messages[messages.length - 1],
    content
  };
  setState({ messages });
}
