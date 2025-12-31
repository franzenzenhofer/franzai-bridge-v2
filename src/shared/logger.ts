export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

type ConsoleLike = Pick<Console, "debug" | "info" | "warn" | "error" | "log">;

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99
};

function resolveLevel(level?: LogLevel): LogLevel {
  if (level) return level;
  const raw = (globalThis as { __FRANZAI_LOG_LEVEL__?: unknown }).__FRANZAI_LOG_LEVEL__;
  if (typeof raw === "string" && raw in LEVELS) return raw as LogLevel;
  return "info";
}

export function createLogger(scope: string, level?: LogLevel, c: ConsoleLike = console) {
  const chosen = resolveLevel(level);
  const min = LEVELS[chosen];
  const prefix = `[FranzAI Bridge/${scope}]`;

  return {
    debug: (...args: unknown[]) => {
      if (min <= LEVELS.debug) c.debug(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      if (min <= LEVELS.info) c.info(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      if (min <= LEVELS.warn) c.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      if (min <= LEVELS.error) c.error(prefix, ...args);
    },
    log: (...args: unknown[]) => {
      if (min <= LEVELS.info) c.log(prefix, ...args);
    }
  } as const;
}
