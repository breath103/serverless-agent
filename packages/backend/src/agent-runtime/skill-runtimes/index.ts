import type { InstallableSkillConfig } from "../../skills/index.js";
import type { SkillRuntimeInstance } from "./define.js";
import { googleCalendar } from "./google-calendar.js";
import { memory } from "./memory.js";
import { webSearch } from "./web-search.js";

export const skillFactories = [memory, webSearch, googleCalendar];

/**
 * Dispatch an installed-skill row to its runtime factory. Switch is exhaustive
 * on `skill_id`; adding a new `InstallableSkillConfig` variant surfaces here as
 * a TS error.
 */
export function loadSkill(
  instanceId: string,
  skill: InstallableSkillConfig,
): SkillRuntimeInstance {
  switch (skill.skill_id) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- single installable variant today; switch makes a second variant fail typecheck
    case "google-calendar":
      return googleCalendar.create(instanceId, skill.config, undefined);
  }
}
