import type { Dict } from "./types";

export const KEY_ALIASES: Record<string, string> = {
  GEMINI_API_KEY: "GOOGLE_API_KEY"
};

export function normalizeKeyName(name: string): string {
  const key = name.trim().toUpperCase();
  return KEY_ALIASES[key] ?? key;
}

export function getAliasKeys(name: string): string[] {
  const normalized = normalizeKeyName(name);
  const keys = new Set<string>([normalized]);
  for (const [alias, canonical] of Object.entries(KEY_ALIASES)) {
    if (canonical === normalized) keys.add(alias);
    if (alias === normalized) keys.add(canonical);
  }
  return Array.from(keys);
}

export function resolveKeyValue(env: Dict<string>, name: string): string {
  const normalized = normalizeKeyName(name);
  if (env[normalized]?.trim()) return env[normalized];

  if (normalized === "GOOGLE_API_KEY" && env.GEMINI_API_KEY?.trim()) {
    return env.GEMINI_API_KEY;
  }

  if (normalized === "GEMINI_API_KEY" && env.GOOGLE_API_KEY?.trim()) {
    return env.GOOGLE_API_KEY;
  }

  return env[name]?.trim() ?? "";
}

export function getConfiguredKeyNames(env: Dict<string>): string[] {
  const names = new Set<string>();
  for (const [key, value] of Object.entries(env)) {
    if (!value?.trim()) continue;
    names.add(normalizeKeyName(key));
  }
  return Array.from(names);
}
