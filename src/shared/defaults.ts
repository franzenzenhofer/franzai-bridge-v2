import type { BridgeSettings } from "./types";

/**
 * SETTINGS_VERSION: Bump this number when defaults change!
 * When stored settings have older version, they auto-reset to new defaults.
 * User's ENV vars (API keys) are preserved during migration.
 */
export const SETTINGS_VERSION = 4;

export const DEFAULT_SETTINGS: BridgeSettings = {
  settingsVersion: SETTINGS_VERSION,
  allowedOrigins: [
    "*"  // Allow ALL origins by default - this extension is for circumventing CORS!
  ],
  allowedDestinations: [
    "*"  // Allow ALL destinations by default - this extension is for circumventing CORS!
  ],
  env: {
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    GOOGLE_API_KEY: "",
    MISTRAL_API_KEY: ""
  },
  injectionRules: [],
  maxLogs: 200
};
