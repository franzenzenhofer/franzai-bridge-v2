/**
 * Bridge AI IDE - AI Streaming Client
 * Multi-model support via Bridge fetch
 */

import type { ChatMessage, ModelId } from "../state/types";

interface ModelConfig {
  host: string;
  path: string;
  formatRequest: (messages: ChatMessage[], systemPrompt: string) => object;
  parseChunk: (line: string) => string | null;
}

const MODELS: Record<ModelId, ModelConfig> = {
  "gpt-4o": {
    host: "api.openai.com",
    path: "/v1/chat/completions",
    formatRequest: (messages, system) => ({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content }))
      ]
    }),
    parseChunk: (line) => {
      if (!line.startsWith("data: ")) return null;
      const data = line.slice(6);
      if (data === "[DONE]") return null;
      try {
        const parsed = JSON.parse(data);
        return parsed.choices?.[0]?.delta?.content ?? null;
      } catch {
        return null;
      }
    }
  },
  "claude-sonnet": {
    host: "api.anthropic.com",
    path: "/v1/messages",
    formatRequest: (messages, system) => ({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      stream: true,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    }),
    parseChunk: (line) => {
      if (!line.startsWith("data: ")) return null;
      const data = line.slice(6);
      try {
        const parsed = JSON.parse(data);
        return parsed.delta?.text ?? null;
      } catch {
        return null;
      }
    }
  },
  "gemini-pro": {
    host: "generativelanguage.googleapis.com",
    path: "/v1beta/models/gemini-1.5-pro:streamGenerateContent",
    formatRequest: (messages, system) => ({
      contents: [
        { role: "user", parts: [{ text: system }] },
        ...messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        }))
      ]
    }),
    parseChunk: (line) => {
      // Gemini uses different streaming format
      try {
        const parsed = JSON.parse(line);
        return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      } catch {
        return null;
      }
    }
  }
};

type FranzAIFetch = (url: string, init?: RequestInit) => Promise<Response>;

function getFranzAI(): { fetch: FranzAIFetch } | null {
  const win = window as Window & { franzai?: { fetch: FranzAIFetch } };
  return win.franzai ?? null;
}

export async function streamChat(
  model: ModelId,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  onDone: () => void
): Promise<void> {
  const config = MODELS[model];
  if (!config) throw new Error(`Unknown model: ${model}`);

  const franzai = getFranzAI();
  if (!franzai) throw new Error("Bridge extension not available");

  const url = `https://${config.host}${config.path}`;
  const body = JSON.stringify(config.formatRequest(messages, systemPrompt));

  const response = await franzai.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const content = config.parseChunk(trimmed);
        if (content) onChunk(content);
      }
    }
  } finally {
    reader.releaseLock();
    onDone();
  }
}

/**
 * Extract HTML code block from AI response
 */
export function extractCodeBlock(response: string): string | null {
  // Match ```html ... ``` blocks
  const htmlMatch = response.match(/```html\s*([\s\S]*?)```/);
  if (htmlMatch) return htmlMatch[1].trim();

  // Fallback: if response starts with <!DOCTYPE or <html, treat as raw HTML
  const trimmed = response.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return trimmed;
  }

  return null;
}
