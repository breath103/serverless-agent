import fs from "node:fs";
import path from "node:path";

import type { SkillRuntimeInstance } from "./skill-runtimes/define.js";
import { memory } from "./skill-runtimes/memory.js";
import { webSearch } from "./skill-runtimes/web-search.js";
import type { SkillCall } from "./types.js";

const DECLARATIONS_DIR = path.join(import.meta.dirname, "declarations", "skills");

function readDeclaration(filename: string): string {
  return fs.readFileSync(path.join(DECLARATIONS_DIR, filename), "utf-8").trim();
}

/** "web-search" → "webSearch" */
function toCamelCase(skillId: string): string {
  return skillId.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** "web-search" → "WebSearch" */
function toPascalCase(skillId: string): string {
  return skillId.replace(/(^|-)([a-z])/g, (_, _sep, c: string) => c.toUpperCase());
}

/**
 * Build skill bindings for the chat sandbox. Built-in skills (`memory`,
 * `webSearch`) are instantiated directly from the agent-runtime factories,
 * with no per-user configuration.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- intentionally async; kept Promise-returning to match previous contract (user-installed skills used to load from DB here).
export async function buildSkills(opts: {
  userId: string;
  skillCalls: SkillCall[];
}): Promise<{ bindings: Record<string, object>; declarations: string[] }> {
  const runtimeOptions = { userId: opts.userId };

  const bindings: Record<string, object> = {};
  const declarations: string[] = [];

  const builtinInstances: SkillRuntimeInstance[] = [
    memory.create("memory", null, runtimeOptions),
    webSearch.create("web-search", null, undefined),
  ];
  builtinInstances.forEach((instance) => {
    const variableName = toCamelCase(instance.skillId);
    const nsName = toPascalCase(instance.skillId);
    bindings[variableName] = traceInstance(instance, opts.skillCalls);
    declarations.push(readDeclaration(`${instance.skillId}.generated.d.ts`));
    declarations.push(`declare const ${variableName}: ${nsName}.Skill;`);
  });

  return { bindings, declarations };
}

/**
 * Proxy-wrap a SkillRuntimeInstance so every method call pushes a typed
 * `SkillCall` entry before returning. Metadata fields (skillId, variableName,
 * etc.) pass through untouched.
 */
/* eslint-disable @typescript-eslint/no-restricted-types -- Proxy wraps arbitrary skill methods */
function traceInstance(instance: SkillRuntimeInstance, skillCalls: SkillCall[]): SkillRuntimeInstance {
  return new Proxy(instance, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== "function") return value;

      return async (params: unknown) => {
        const result = await (value as (p: unknown) => Promise<unknown>).call(target, params);
        skillCalls.push({
          skill: target.skillId,
          method: String(prop),
          params,
          output: JSON.parse(JSON.stringify(result)),
        } as SkillCall);
        return result;
      };
    },
  });
}
/* eslint-enable @typescript-eslint/no-restricted-types */
