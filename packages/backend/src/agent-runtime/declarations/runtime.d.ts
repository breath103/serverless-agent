// --- Sandbox utilities ---

/**
 * Surface a value back to the LLM for inspection. Call this on any value
 * you want to "see" from the code block — it gets serialized and returned
 * as part of the tool result.
 */
declare function read(value: unknown): void;

// --- Sandbox environment ---
// This code runs in a sandboxed VM. Only the globals listed below are
// available. There is NO require, import, process, or fs. Built-in globals
// (Array, Object, Map, Set, Promise, Date, Math, JSON, etc.) are provided
// by sandbox-lib.d.ts. Only sandbox-specific globals are declared here.

declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

declare function fetch(
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;
