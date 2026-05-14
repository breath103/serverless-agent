import z from "zod";

import { defineSkill } from "./define-skill.js";

export const memory = defineBuiltInSkill({
  id: "memory",
  displayName: "Memory",
  description: "Search and read user's saved memories",
});

export const webSearch = defineBuiltInSkill({
  id: "web-search",
  displayName: "Web Search",
  description: "Search the web for real-time information",
});

function defineBuiltInSkill<TId extends string, TEvent>({ id, displayName, description, eventSchema }: {
  readonly id: TId;
  readonly displayName: string;
  readonly description: string;
  readonly eventSchema?: z.ZodType<TEvent>;
}) {
  return defineSkill({
    id,
    displayName,
    description,
    // Builtin Skills can't have config since it's "builtin". context are injected in SkillRuntime level
    configSchema: z.null(),
    eventSchema: eventSchema ?? z.never(),
    install: { type: "builtin" } as const
  });
}
