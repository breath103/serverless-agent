import { z } from "zod";

// List of skills
import { memory, webSearch } from "./builtins.js";

export const skillHandlers = {
  // Builtins
  [memory.id]: memory,
  [webSearch.id]: webSearch,
} as const;

export type SkillId = keyof typeof skillHandlers;

/** Maps each skill ID to its resolved config type. */
export type SkillConfigMap = { [K in SkillId]: z.infer<(typeof skillHandlers)[K]["configSchema"]> };

type SkillEventMap = { [K in SkillId]: z.infer<(typeof skillHandlers)[K]["eventSchema"]> };
type FilterNeverEvent<T> = T extends { event: never } ? never : T;
/** @public — required from frontend */
export type SkillEvent = FilterNeverEvent<{ [K in SkillId]: { skill_id: K; event: SkillEventMap[K] } }[SkillId]>;
