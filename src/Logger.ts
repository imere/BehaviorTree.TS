export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogRecord = {
  level: LogLevel;
  message: string;
};

export type LogSink = (record: LogRecord) => void;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const defaultSink: LogSink = ({ level, message }) => {
  if (level === "error") console.error(message);
  else if (level === "warn") console.warn(message);
  else console.log(message);
};

let sink: LogSink = defaultSink;
let threshold: LogLevel = "warn";

/** Replaces the destination for every log record. Return the old sink to restore it. */
export function setLogSink(next: LogSink): LogSink {
  const previous = sink;
  sink = next;
  return previous;
}

export function setLogLevel(level: LogLevel): void {
  threshold = level;
}

export function getLogLevel(): LogLevel {
  return threshold;
}

export function debug(message: string): void {
  emit("debug", message);
}

export function info(message: string): void {
  emit("info", message);
}

export function warn(message: string): void {
  emit("warn", message);
}

export function error(message: string): void {
  emit("error", message);
}

function emit(level: LogLevel, message: string): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[threshold]) return;
  sink({ level, message });
}
