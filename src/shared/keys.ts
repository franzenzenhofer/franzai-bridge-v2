import type { Dict } from "./types";

export function getConfiguredKeyNames(env: Dict<string>): string[] {
  return Object.keys(env).filter((name) => env[name]?.trim());
}
