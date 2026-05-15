import fs from "node:fs";
import path from "node:path";

import { taggedConfig } from "../skills/index.js";
import { refreshAndPersist } from "../skills/refresh.js";
import { userSkillsRepo } from "../skills/user-skills-repository.js";
import type { SkillRuntimeInstance } from "./skill-runtimes/define.js";
import { loadSkill } from "./skill-runtimes/index.js";
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
 * Build skill bindings for the chat sandbox.
 *
 * - Built-in skills (`memory`, `webSearch`) — instantiated directly from the
 *   agent-runtime factories. No config; always on.
 * - User-installed skills (Google Calendar, …) — loaded from `user_skills`.
 *   Each row's config is run through the handler's `refreshConfig` first;
 *   if the OAuth token rotated, the new config is persisted before use so
 *   the next turn starts from the fresh state.
 *
 * Every instance is proxy-wrapped so method calls push typed `SkillCall`
 * entries into the caller's buffer for UI rendering.
 */
export async function buildSkills(opts: {
  userId: string;
  skillCalls: SkillCall[];
}): Promise<{ bindings: Record<string, object>; declarations: string[] }> {
  const runtimeOptions = { userId: opts.userId };

  const bindings: Record<string, object> = {};
  const declarations: string[] = [];

  // ── Built-ins ─────────────────────────────────────────────────────────
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

  // ── User-installed ────────────────────────────────────────────────────
  // Refresh-on-load per row → bind by camelSkillId. Since we dedupe on
  // (user_id, skill_id) at the OAuth callback, there's at most one row per
  // skill per user, so a plain camelSkillId binding is unambiguous.
  //
  // Per-row failures (revoked grant, expired refresh token, provider 5xx)
  // are logged and the row is skipped — the rest of the agent (memory,
  // webSearch, other healthy skills) stays functional for that turn.
  const rows = await userSkillsRepo.listForUser(opts.userId);
  for (const row of rows) {
    let config;
    try {
      ({ config } = await refreshAndPersist(row));
    } catch (err) {
      console.error(
        `[build-skills] skill=${row.data.skill_id} user=${opts.userId} id=${row.id}: ${err instanceof Error ? err.message : String(err)} — skipping binding`,
      );
      continue;
    }
    const instance = loadSkill(row.id, taggedConfig(row.data.skill_id, config));
    const variableName = toCamelCase(instance.skillId);
    const nsName = toPascalCase(instance.skillId);
    bindings[variableName] = traceInstance(instance, opts.skillCalls);
    declarations.push(readDeclaration(`${instance.skillId}.generated.d.ts`));
    declarations.push(`declare const ${variableName}: ${nsName}.Skill;`);
  }

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
