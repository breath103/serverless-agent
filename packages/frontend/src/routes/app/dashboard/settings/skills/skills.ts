import type { InstallableSkillId, SkillConfigMap } from "@backend/skills/index";
import type { UserSkillRow } from "@backend/types/database";

import googleCalendarIcon from "@/assets/skill-icons/google-calendar.webp";
import telegramIcon from "@/assets/skill-icons/telegram.webp";

/** Catalog entry for each installable skill the settings page renders. */
export interface SkillDisplaySettings<TId extends InstallableSkillId> {
  readonly displayName: string;
  readonly description: string;
  readonly iconUrl: string;
  /** Pull the user-facing account label out of the persisted config. */
  readonly buildAccountLabel: (config: SkillConfigMap[TId]) => string;
}

type SkillsMap = { [K in InstallableSkillId]: SkillDisplaySettings<K> };

export const SKILLS: SkillsMap = {
  "google-calendar": {
    displayName: "Google Calendar",
    description: "List, create, update, and delete Google Calendar events",
    iconUrl: googleCalendarIcon,
    buildAccountLabel: (config) => config.email,
  },
  "telegram": {
    displayName: "Telegram",
    description: "Talk to the agent via a Telegram bot — messages mirror to and from chat",
    iconUrl: telegramIcon,
    buildAccountLabel: (config) => (config.bot_username ? `@${config.bot_username}` : "(unbound bot)"),
  },
};

export const SKILL_IDS: InstallableSkillId[] = Object.keys(SKILLS) as InstallableSkillId[];

/**
 * Dispatcher for `buildAccountLabel` over the tagged-union of installed-skill
 * rows. A direct `SKILLS[id].buildAccountLabel(config)` call doesn't typecheck
 * because TS unifies the parameter type across the union to an intersection.
 * The exhaustive switch keeps narrowing per-variant.
 */
export function accountLabel(data: UserSkillRow["data"]): string {
  switch (data.skill_id) {
    case "google-calendar":
      return SKILLS["google-calendar"].buildAccountLabel(data.config);
    case "telegram":
      return SKILLS["telegram"].buildAccountLabel(data.config);
  }
}
