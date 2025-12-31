export function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .trim()
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function matchesAnyPattern(value: string, patterns: string[]): boolean {
  const v = value.trim();
  return patterns.some((p) => wildcardToRegExp(p).test(v));
}
