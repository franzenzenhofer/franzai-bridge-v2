import type { Dict, InjectionRule } from "./types";
import { resolveKeyValue } from "./keys";

export function builtinProviderRules(): InjectionRule[] {
  return [
    {
      hostPattern: "api.openai.com",
      injectHeaders: {
        Authorization: "Bearer ${OPENAI_API_KEY}"
      }
    },
    {
      hostPattern: "api.anthropic.com",
      injectHeaders: {
        "x-api-key": "${ANTHROPIC_API_KEY}",
        "anthropic-version": "2023-06-01" // Hardcoded - users don't need to configure this
      }
    },
    {
      hostPattern: "generativelanguage.googleapis.com",
      injectHeaders: {
        "x-goog-api-key": "${GOOGLE_API_KEY}"
      }
    },
    {
      hostPattern: "api.mistral.ai",
      injectHeaders: {
        Authorization: "Bearer ${MISTRAL_API_KEY}"
      }
    }
  ];
}

export function expandTemplate(input: string, env: Dict<string>): string {
  return input.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name: string) => resolveKeyValue(env, name));
}

export function headersToObject(
  headers?: HeadersInit | Dict<string> | [string, string][]
): Dict<string> {
  const out: Dict<string> = {};
  if (!headers) return out;

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }

  if (Array.isArray(headers)) {
    for (const [k, v] of headers) out[k] = v;
    return out;
  }

  for (const [k, v] of Object.entries(headers)) {
    out[k] = String(v);
  }
  return out;
}

export function hasHeader(headers: Dict<string>, name: string): boolean {
  const n = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === n);
}
