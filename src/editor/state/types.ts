/**
 * Bridge AI IDE - State Types
 */

export interface EditorState {
  // Extension status
  extension: {
    ready: boolean;
    version: string | null;
  };
  keys: {
    openai: boolean;
    anthropic: boolean;
    google: boolean;
  };

  // Editor - Single HTML file
  view: "preview" | "code" | "request";
  code: string;
  previousCode: string;

  // Version History
  history: HistoryEntry[];
  historyIndex: number;

  // AI
  model: ModelId;
  messages: ChatMessage[];
  isStreaming: boolean;

  // Console
  logs: ConsoleLog[];

  // Project
  projectName: string;
  isDirty: boolean;
  lastSnapshot: string | null;
  contextFiles: ContextFile[];

  // API Request/Response (for debugging)
  lastRequest: ApiRequest | null;
  lastResponse: ApiResponse | null;
}

export interface ApiRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  duration: number;
  error?: string;
}

export interface HistoryEntry {
  code: string;
  timestamp: number;
}

export type ModelId = "gpt-5-mini" | "claude-haiku-4-5" | "gemini-2.5-flash";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  hasCode?: boolean;
  code?: string;
  changes?: string[];
  isStreaming?: boolean;
  isError?: boolean;
}

/** Structured response from AI - all providers normalize to this */
export interface AIResponse {
  explanation: string;
  code: string;
  changes?: string[];
}

export interface ConsoleLog {
  type: "log" | "warn" | "error" | "info";
  message: string;
  timestamp: number;
}

export interface ContextFile {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
}

export type StateKey = keyof EditorState;

export type StateListener = (state: EditorState, changedKeys: StateKey[]) => void;

// Default template for new projects
export const DEFAULT_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Bridge App</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
    }
    h1 { color: #1a73e8; }
  </style>
</head>
<body>
  <h1>Hello Bridge!</h1>
  <p>Start building your app with AI assistance.</p>

  <script>
    console.log("App loaded!");
  </script>
</body>
</html>`;
