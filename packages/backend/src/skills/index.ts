import { z } from "zod";

// List of skills
import { memory, webSearch } from "./builtins.js";
import { googleCalendar } from "./google.js";

export const skillHandlers = {
  // Builtins
  [memory.id]: memory,
  [webSearch.id]: webSearch,

  // Installable — Google (oauth2)
  [googleCalendar.id]: googleCalendar,
} as const;

type SkillMap = typeof skillHandlers;

export type SkillId = keyof typeof skillHandlers;

/** Maps each skill ID to its resolved config type. */
export type SkillConfigMap = { [K in SkillId]: z.infer<(typeof skillHandlers)[K]["configSchema"]> };

type SkillEventMap = { [K in SkillId]: z.infer<(typeof skillHandlers)[K]["eventSchema"]> };
type FilterNeverEvent<T> = T extends { event: never } ? never : T;
/** @public — required from frontend */
export type SkillEvent = FilterNeverEvent<{ [K in SkillId]: { skill_id: K; event: SkillEventMap[K] } }[SkillId]>;

// Filter skill IDs by install.type — discriminates builtins from installables
// (and oauth2 from any future auth-type).
type InstallTypeFilteredSkillMap<Type extends string> = {
  [K in keyof SkillMap as SkillMap[K]["install"]["type"] extends Type ? K : never]: SkillMap[K]
};

/** @public — required from frontend */
export type Oauth2InstallSkillMap = InstallTypeFilteredSkillMap<"oauth2">;

/** @public — required from frontend */
export type InstallableSkillId = keyof Oauth2InstallSkillMap;
/** @public — Tagged-union of every installable skill's persisted config. */
export type InstallableSkillConfig = {
  [K in InstallableSkillId]: { skill_id: K; config: z.infer<Oauth2InstallSkillMap[K]["configSchema"]> }
}[InstallableSkillId];

/**
 * Build a tagged `InstallableSkillConfig` variant. Necessary because TS can't
 * pair the `skill_id` discriminator with the corresponding `config` shape
 * across a union of map keys — the cast is sound because callers always
 * supply the matching pair (statically narrowed at the call site).
 */
export function taggedConfig(
  skillId: InstallableSkillId,
  config: InstallableSkillConfig["config"],
): InstallableSkillConfig {
  return { skill_id: skillId, config } as InstallableSkillConfig;
}
