type Level = "debug" | "info" | "warn" | "error";

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

function serializeError(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  return value;
}

/**
 * Structured JSON logger. Each line is a single JSON object, which CloudWatch Logs Insights
 * discovers automatically (e.g. `filter event = "ingestion.completed" | stats avg(durationMs)`).
 */
export function createLogger(base: Record<string, unknown> = {}, sink: (line: string) => void = console.log): Logger {
  const write = (level: Level, message: string, fields: Record<string, unknown> = {}) => {
    const entry: Record<string, unknown> = { timestamp: new Date().toISOString(), level, message, ...base };
    for (const [key, value] of Object.entries(fields)) entry[key] = serializeError(value);
    sink(JSON.stringify(entry));
  };
  return {
    info: (m, f) => write("info", m, f),
    warn: (m, f) => write("warn", m, f),
    error: (m, f) => write("error", m, f),
    child: (fields) => createLogger({ ...base, ...fields }, sink),
  };
}
