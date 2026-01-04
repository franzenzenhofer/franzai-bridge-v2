/**
 * Bridge AI IDE - AI Client with Structured Output + Streaming
 * Returns { explanation, code, changes } from all providers
 */

import type { ChatMessage, ModelId, AIResponse } from "../state/types";
import { setState } from "../state/store";

/** JSON Schema for structured response (shared across providers) */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    explanation: { type: "string", description: "Friendly explanation of what was built/changed" },
    code: { type: "string", description: "Complete HTML file with inline CSS and JS" },
    changes: { type: "array", items: { type: "string" }, description: "List of changes made" }
  },
  required: ["explanation", "code"]
};

/** Extended RequestInit with Bridge options */
interface BridgeRequestInit extends RequestInit {
  franzai?: { timeout?: number; stream?: boolean };
}

type FranzAIFetch = (url: string, init?: BridgeRequestInit) => Promise<Response>;

/** AI calls need longer timeout (2 minutes) due to large prompts */
const AI_TIMEOUT_MS = 120_000;

function getFranzAI(): { fetch: FranzAIFetch } | null {
  const win = window as Window & { franzai?: { fetch: FranzAIFetch } };
  return win.franzai ?? null;
}

/** Format request for Gemini with JSON mode (non-streaming) */
function formatGeminiRequest(messages: ChatMessage[], systemPrompt: string) {
  return {
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }))
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA
    }
  };
}

/** Format request for Gemini streaming (no JSON schema = token-by-token streaming) */
function formatGeminiStreamRequest(messages: ChatMessage[], systemPrompt: string) {
  // Without responseMimeType/responseSchema, Gemini streams token-by-token
  // It will still follow the system prompt's JSON format instructions
  return {
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }))
    ]
  };
}

/** Format request for OpenAI with JSON schema mode */
function formatOpenAIRequest(messages: ChatMessage[], systemPrompt: string) {
  return {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "code_response",
        strict: true,
        schema: RESPONSE_SCHEMA
      }
    }
  };
}

/** Format request for Anthropic with tool use */
function formatAnthropicRequest(messages: ChatMessage[], systemPrompt: string) {
  return {
    model: "claude-haiku-4-5-20241022",
    max_tokens: 16384,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: [{
      name: "respond",
      description: "Return the response with explanation and code",
      input_schema: RESPONSE_SCHEMA
    }],
    tool_choice: { type: "tool", name: "respond" }
  };
}

/** Parse Gemini JSON response */
function parseGeminiResponse(data: unknown): AIResponse | null {
  const d = data as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  return JSON.parse(text);
}

/** Parse OpenAI JSON response */
function parseOpenAIResponse(data: unknown): AIResponse | null {
  const d = data as { choices?: { message?: { content?: string } }[] };
  const content = d.choices?.[0]?.message?.content;
  if (!content) return null;
  return JSON.parse(content);
}

/** Parse Anthropic tool use response */
function parseAnthropicResponse(data: unknown): AIResponse | null {
  const d = data as { content?: { type: string; input?: AIResponse }[] };
  const toolUse = d.content?.find((c) => c.type === "tool_use");
  if (!toolUse?.input) return null;
  return toolUse.input;
}

/** Fallback: extract code from markdown response (NOT for JSON) */
function extractFromMarkdown(text: string): AIResponse | null {
  // Skip if this looks like JSON (starts with { or [)
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return null;
  }

  // Try code block patterns: ```html, ```HTML, or generic ```
  const htmlMatch = text.match(/```(?:html|HTML)?\s*([\s\S]*?)```/);
  if (htmlMatch?.[1]) {
    const code = htmlMatch[1].trim();
    if (code.startsWith("<!DOCTYPE") || code.startsWith("<html") || code.startsWith("<")) {
      const explanation = text.replace(/```(?:html|HTML)?[\s\S]*?```/, "").trim();
      return { explanation, code };
    }
  }

  // Try raw HTML (entire response is HTML)
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return { explanation: "", code: trimmed };
  }

  return null;
}

type ModelConfig = {
  url: string;
  streamUrl?: string;
  format: (messages: ChatMessage[], system: string) => object;
  formatStream?: (messages: ChatMessage[], system: string) => object;
  parse: (data: unknown) => AIResponse | null;
  parseSSE?: (line: string) => string | null;
};

const MODEL_CONFIG: Record<ModelId, ModelConfig> = {
  "gemini-2.5-flash": {
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    streamUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
    format: formatGeminiRequest,
    formatStream: formatGeminiStreamRequest, // No JSON schema = true token streaming
    parse: parseGeminiResponse,
    parseSSE: (line: string) => {
      if (!line.startsWith("data: ")) return null;
      try {
        const json = JSON.parse(line.slice(6));
        return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      } catch {
        return null;
      }
    }
  },
  "gpt-5-mini": {
    url: "https://api.openai.com/v1/chat/completions",
    format: formatOpenAIRequest,
    parse: parseOpenAIResponse
  },
  "claude-haiku-4-5": {
    url: "https://api.anthropic.com/v1/messages",
    format: formatAnthropicRequest,
    parse: parseAnthropicResponse
  }
};

export type StreamCallbacks = {
  onChunk?: (text: string) => void;
  onDone?: () => void;
  signal?: AbortSignal | undefined;
};

/** Streaming chat - calls onChunk with accumulated text as response streams */
export async function streamingChat(
  model: ModelId,
  messages: ChatMessage[],
  systemPrompt: string,
  callbacks: StreamCallbacks = {}
): Promise<AIResponse> {
  const config = MODEL_CONFIG[model];
  if (!config) throw new Error(`Unknown model: ${model}`);

  const franzai = getFranzAI();
  if (!franzai) throw new Error("Bridge extension not available");

  // Use streaming URL and format if available
  const url = config.streamUrl ?? config.url;
  const formatFn = config.streamUrl && config.formatStream ? config.formatStream : config.format;
  const requestBody = formatFn(messages, systemPrompt);
  const startTime = Date.now();

  setState({
    lastRequest: {
      url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      timestamp: startTime
    },
    lastResponse: null
  });

  const requestInit: BridgeRequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    franzai: { stream: Boolean(config.streamUrl), timeout: AI_TIMEOUT_MS }
  };
  if (callbacks.signal) requestInit.signal = callbacks.signal;

  const response = await franzai.fetch(url, requestInit);

  if (!response.ok) {
    const errorText = await response.text();
    setState({
      lastResponse: {
        status: response.status,
        statusText: response.statusText,
        headers: toHeadersRecord(response.headers),
        body: { error: errorText },
        duration: Date.now() - startTime,
        error: errorText
      }
    });
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  // If streaming with SSE parser
  if (config.streamUrl && config.parseSSE && response.body) {
    let accumulatedText = "";
    const reader = response.body.getReader();
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

          const chunk = config.parseSSE(trimmed);
          if (chunk) {
            accumulatedText += chunk;
            callbacks.onChunk?.(accumulatedText);
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const chunk = config.parseSSE(buffer.trim());
        if (chunk) {
          accumulatedText += chunk;
          callbacks.onChunk?.(accumulatedText);
        }
      }
    } finally {
      callbacks.onDone?.();
    }

    setState({
      lastResponse: {
        status: response.status,
        statusText: response.statusText,
        headers: toHeadersRecord(response.headers),
        body: { streaming: true, textLength: accumulatedText.length },
        duration: Date.now() - startTime
      }
    });

    // Parse accumulated JSON (may be wrapped in ```json ... ``` code block)
    let jsonText = accumulatedText.trim();

    // Strip markdown code fences if present
    const jsonFenceMatch = jsonText.match(/^```(?:json)?\s*([\s\S]*?)```$/);
    if (jsonFenceMatch?.[1]) {
      jsonText = jsonFenceMatch[1].trim();
    }

    try {
      const result = JSON.parse(jsonText) as AIResponse;
      if (result.code) return result;
      console.warn("[ai-client] JSON parsed but missing code field:", Object.keys(result));
    } catch (e) {
      console.warn("[ai-client] JSON parse failed:", e instanceof Error ? e.message : e);
      console.warn("[ai-client] First 200 chars:", jsonText.slice(0, 200));
    }

    const fromMarkdown = extractFromMarkdown(accumulatedText);
    if (fromMarkdown?.code) return fromMarkdown;

    throw new Error(`Failed to parse streaming response (${accumulatedText.length} chars)`);
  }

  // Fallback to buffered response
  const data = await response.json();
  callbacks.onDone?.();

  setState({
    lastResponse: {
      status: response.status,
      statusText: response.statusText,
      headers: toHeadersRecord(response.headers),
      body: data,
      duration: Date.now() - startTime
    }
  });

  try {
    const result = config.parse(data);
    if (result?.code) return result;
  } catch { /* continue to fallback */ }

  const rawText = extractRawText(data, model);
  if (rawText) {
    const fromMarkdown = extractFromMarkdown(rawText);
    if (fromMarkdown?.code) return fromMarkdown;
  }

  throw new Error("Failed to get valid response from AI");
}

/** Main chat function - non-streaming, returns structured AIResponse */
export async function chat(
  model: ModelId,
  messages: ChatMessage[],
  systemPrompt: string,
  retryCount = 0,
  options?: { signal?: AbortSignal }
): Promise<AIResponse> {
  try {
    return await streamingChat(model, messages, systemPrompt, { signal: options?.signal });
  } catch (err) {
    if (retryCount < 1) {
      const strictPrompt = systemPrompt + "\n\nCRITICAL: You MUST return valid JSON with 'explanation' and 'code' fields. No markdown, just JSON.";
      return chat(model, messages, strictPrompt, retryCount + 1, options);
    }
    throw err;
  }
}

/** Extract raw text from response for fallback parsing */
function extractRawText(data: unknown, model: ModelId): string | null {
  if (model === "gemini-2.5-flash") {
    const d = data as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return d.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  }
  if (model === "gpt-5-mini") {
    const d = data as { choices?: { message?: { content?: string } }[] };
    return d.choices?.[0]?.message?.content ?? null;
  }
  if (model === "claude-haiku-4-5") {
    const d = data as { content?: { type: string; text?: string }[] };
    const textBlock = d.content?.find((c) => c.type === "text");
    return textBlock?.text ?? null;
  }
  return null;
}

/** Legacy streaming function - now uses real streaming */
export async function streamChat(
  model: ModelId,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  options?: { signal?: AbortSignal }
): Promise<void> {
  await streamingChat(model, messages, systemPrompt, {
    onChunk,
    onDone,
    signal: options?.signal
  });
}

/** Legacy: Extract HTML code block from AI response */
export function extractCodeBlock(response: string): string | null {
  try {
    const parsed = JSON.parse(response) as AIResponse;
    if (parsed.code) return parsed.code;
  } catch { /* not JSON */ }

  const htmlMatch = response.match(/```html\s*([\s\S]*?)```/);
  if (htmlMatch?.[1]) return htmlMatch[1].trim();

  const trimmed = response.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return trimmed;
  }
  return null;
}

function toHeadersRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}
