import type { googleCalendar } from "./skill-runtimes/google-calendar.js";
import type { memory } from "./skill-runtimes/memory.js";
import type { webSearch } from "./skill-runtimes/web-search.js";

/**
 * Typed union of every possible skill method call. Each variant carries
 * its skill id, method name, exact params shape, and exact output shape.
 *
 * All variants are derived from each skill factory via
 * `typeof skill.$infer.methods` — adding / renaming a method on the factory
 * updates this union automatically.
 *
 * Populated by proxies in skills.ts — each wrapped method call pushes
 * an entry before returning the real result. UI renders via the
 * discriminated union; LLM never sees these (only sees `reads`).
 */

type Methods<F> = F extends { $infer: { methods: infer M } } ? M : never;

type CallsOf<Id extends string, F> = {
  [K in keyof Methods<F> & string]: Methods<F>[K] extends (params: infer P) => Promise<infer O>
    ? { skill: Id; method: K; params: P; output: Awaited<O> }
    : never;
}[keyof Methods<F> & string];

export type SkillCall =
  | CallsOf<"memory", typeof memory>
  | CallsOf<"web-search", typeof webSearch>
  | CallsOf<"google-calendar", typeof googleCalendar>;
