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
    gemini: boolean;
  };

  // Editor - Single HTML file
  view: "preview" | "code";
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
}

export interface HistoryEntry {
  code: string;
  timestamp: number;
}

export type ModelId = "gpt-4o" | "claude-sonnet" | "gemini-pro";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  hasCode?: boolean;
}

export interface ConsoleLog {
  type: "log" | "warn" | "error" | "info";
  message: string;
  timestamp: number;
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
