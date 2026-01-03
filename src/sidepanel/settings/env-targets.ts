import type { BridgeSettings, InjectionRule } from "../../shared/types";
import { normalizeKeyName } from "../../shared/keys";

export const BUILTIN_KEY_TARGETS: Record<string, string> = {
  OPENAI_API_KEY: "api.openai.com",
  ANTHROPIC_API_KEY: "api.anthropic.com",
  GOOGLE_API_KEY: "generativelanguage.googleapis.com",
  MISTRAL_API_KEY: "api.mistral.ai"
};

export function getTargetDomain(key: string, settings: BridgeSettings | null): string | null {
  const canonicalKey = normalizeKeyName(key);
  const builtin = BUILTIN_KEY_TARGETS[canonicalKey];
  if (builtin) return builtin;
  if (!settings?.injectionRules) return null;

  const rule = settings.injectionRules.find((r: InjectionRule) => {
    if (!r.injectHeaders) return false;
    return Object.values(r.injectHeaders).some((v) => v.includes(`\${${canonicalKey}}`));
  });

  return rule ? rule.hostPattern : null;
}
