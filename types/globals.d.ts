// The library references exactly three globals: setTimeout, clearTimeout and
// console. No single lib typing set covers every environment this runs in, so
// rather than assume one, declare only these three.
//
// Timer handles are stored as `any` in the source, so the return type is never
// actually used. The handler is left open because callers pass callbacks that
// take the resolve argument. Only pulled in by the build/typecheck configs,
// and not part of the published declarations.
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number): unknown;
declare function clearTimeout(handle: unknown): void;

declare var console: {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
};
