import type { InstallableSkillId, SkillConfigMap } from "@backend/skills/index";

import googleCalendarIcon from "@/assets/skill-icons/google-calendar.webp";

/** Catalog entry for each installable skill the settings page renders. */
export interface SkillDisplaySettings<TId extends InstallableSkillId> {
  readonly displayName: string;
  readonly description: string;
  readonly iconUrl: string;
  readonly permissions: readonly string[];
  /** Pull the user-facing account label out of the persisted config. */
  readonly buildAccountLabel: (config: SkillConfigMap[TId]) => string;
}

type SkillsMap = { [K in InstallableSkillId]: SkillDisplaySettings<K> };

export const SKILLS: SkillsMap = {
  "google-calendar": {
    displayName: "Google Calendar",
    description: "List, create, update, and delete Google Calendar events",
    iconUrl: googleCalendarIcon,
    permissions: ["Read events", "Create events", "Modify events"],
    buildAccountLabel: (config) => config.email,
  },
};

export const SKILL_IDS: InstallableSkillId[] = Object.keys(SKILLS) as InstallableSkillId[];
