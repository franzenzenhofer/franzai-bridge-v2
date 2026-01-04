/**
 * Bridge AI IDE - AI Client with Structured Output
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
  franzai?: { timeout?: number };
}

type FranzAIFetch = (url: string, init?: BridgeRequestInit) => Promise<Response>;

/** AI calls need longer timeout (2 minutes) due to large prompts */
const AI_TIMEOUT_MS = 120_000;

function getFranzAI(): { fetch: FranzAIFetch } | null {
  const win = window as Window & { franzai?: { fetch: FranzAIFetch } };
  return win.franzai ?? null;
}

/** Format request for Gemini with JSON mode */
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

/** Fallback: extract code from markdown response */
function extractFromMarkdown(text: string): AIResponse | null {
  const htmlMatch = text.match(/```html\s*([\s\S]*?)```/);
  if (!htmlMatch) {
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      return { explanation: "", code: text.trim() };
    }
    return null;
  }
  const code = htmlMatch[1];
  if (!code) return null;
  const trimmedCode = code.trim();
  const explanation = text.replace(/```html[\s\S]*?```/, "").trim();
  return { explanation, code: trimmedCode };
}

const MODEL_CONFIG: Record<ModelId, {
  url: string;
  format: (messages: ChatMessage[], system: string) => object;
  parse: (data: unknown) => AIResponse | null;
}> = {
  "gemini-2.5-flash": {
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    format: formatGeminiRequest,
    parse: parseGeminiResponse
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

/** Main chat function - returns structured AIResponse */
export async function chat(
  model: ModelId,
  messages: ChatMessage[],
  systemPrompt: string,
  retryCount = 0,
  options?: { signal?: AbortSignal }
): Promise<AIResponse> {
  const config = MODEL_CONFIG[model];
  if (!config) throw new Error(`Unknown model: ${model}`);

  const franzai = getFranzAI();
  if (!franzai) throw new Error("Bridge extension not available");

  const requestBody = config.format(messages, systemPrompt);
  const startTime = Date.now();

  setState({
    lastRequest: {
      url: config.url,
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
    franzai: { timeout: AI_TIMEOUT_MS }
  };
  if (options?.signal) requestInit.signal = options.signal;

  const response = await franzai.fetch(config.url, requestInit);

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

  const data = await response.json();
  setState({
    lastResponse: {
      status: response.status,
      statusText: response.statusText,
      headers: toHeadersRecord(response.headers),
      body: data,
      duration: Date.now() - startTime
    }
  });

  // Step 1: Try structured JSON parsing
  try {
    const result = config.parse(data);
    if (result?.code) return result;
  } catch { /* continue to fallback */ }

  // Step 2: Try markdown extraction fallback
  const rawText = extractRawText(data, model);
  if (rawText) {
    const fromMarkdown = extractFromMarkdown(rawText);
    if (fromMarkdown?.code) return fromMarkdown;
  }

  // Step 3: Auto-retry once with stricter prompt
  if (retryCount < 1) {
    const strictPrompt = systemPrompt + "\n\nCRITICAL: You MUST return valid JSON with 'explanation' and 'code' fields. No markdown, just JSON.";
    return chat(model, messages, strictPrompt, retryCount + 1, options);
  }

  // Step 4: Give up
  throw new Error("Failed to get valid response from AI after retry");
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

/** Legacy streaming function - kept for compatibility but prefer chat() */
export async function streamChat(
  model: ModelId,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  options?: { signal?: AbortSignal }
): Promise<void> {
  try {
    const result = await chat(model, messages, systemPrompt, 0, options);
    onChunk(JSON.stringify(result));
    onDone();
  } catch (err) {
    onDone();
    throw err;
  }
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
