import type { BridgeSettings, Dict, InjectionRule } from "./types";
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from "./defaults";
import { MAX_LOGS_LIMIT, MIN_LOGS_LIMIT } from "./constants";

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string");
}

function toStringDict(value: unknown): Dict<string> {
  const out: Dict<string> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function toRules(value: unknown): InjectionRule[] {
  if (!Array.isArray(value)) return [];
  const rules: InjectionRule[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rule = item as Partial<InjectionRule>;
    if (typeof rule.hostPattern !== "string") continue;
    rules.push({
      hostPattern: rule.hostPattern,
      injectHeaders: rule.injectHeaders ? toStringDict(rule.injectHeaders) : undefined,
      injectQuery: rule.injectQuery ? toStringDict(rule.injectQuery) : undefined
    });
  }
  return rules;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function normalizeSettings(input?: Partial<BridgeSettings> | null): BridgeSettings {
  const allowedOrigins = toStringArray(input?.allowedOrigins, DEFAULT_SETTINGS.allowedOrigins);
  const allowedDestinations = toStringArray(
    input?.allowedDestinations,
    DEFAULT_SETTINGS.allowedDestinations
  );
  const env = {
    ...DEFAULT_SETTINGS.env,
    ...toStringDict(input?.env)
  };
  const injectionRules = toRules(input?.injectionRules);
  const maxLogs = clampNumber(
    input?.maxLogs,
    DEFAULT_SETTINGS.maxLogs,
    MIN_LOGS_LIMIT,
    MAX_LOGS_LIMIT
  );

  return {
    settingsVersion: SETTINGS_VERSION,
    allowedOrigins,
    allowedDestinations,
    env,
    injectionRules,
    maxLogs
  };
}
