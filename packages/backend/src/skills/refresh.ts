import { publishRealtimeEvent } from "../lib/realtime-publish.js";
import type { UserSkillRow } from "../types/database.js";
import type { InstallableSkillConfig } from "./index.js";
import { skillHandlers, taggedConfig } from "./index.js";
import { userSkillsRepo } from "./user-skills-repository.js";

/**
 * Refresh a single user_skill row's OAuth tokens and persist+publish if the
 * access token rotated. Thrown errors (revoked grant, expired refresh token,
 * provider 5xx, …) propagate to the caller — the caller decides whether to
 * surface the failure or skip the skill for that invocation.
 *
 * Single source of truth shared between:
 *   - `agent-runtime/skills.ts` — refresh-on-load before binding to the chat
 *     sandbox.
 *   - `worker/refresh-user-skills.ts` — periodic EventBridge sweep across
 *     every row.
 */
export async function refreshAndPersist(
  row: UserSkillRow,
): Promise<{ config: InstallableSkillConfig["config"]; rotated: boolean }> {
  const handler = skillHandlers[row.data.skill_id];
  // Only oauth2 install variants carry a `refreshConfig` — channel skills
  // (telegram) have no token lifecycle and stay as-is.
  if (handler.install.type !== "oauth2") return { config: row.data.config, rotated: false };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- skill_id ↔ config correlation enforced by InstallableSkillConfig discriminator
  const config: any = row.data.config;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- same correlation
  const refreshed = await handler.install.refreshConfig(config);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- same correlation
  if (refreshed.expiresAt === config.expiresAt) {
    return { config: refreshed, rotated: false };
  }

  const updated = await userSkillsRepo.updateData(
    row.user_id,
    row.id,
    taggedConfig(row.data.skill_id, refreshed),
  );
  if (updated) {
    await publishRealtimeEvent(row.user_id, {
      type: "entity_update",
      table: "user_skills",
      op: "upsert",
      row: updated,
    });
  }
  return { config: refreshed, rotated: true };
}
