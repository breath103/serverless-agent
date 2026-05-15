import { publishRealtimeEvent } from "../lib/realtime-publish.js";
import type { UserSkillRow } from "../types/database.js";
import type { InstallableSkillConfig } from "./index.js";
import { skillHandlers } from "./index.js";
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
  const refreshed = await handler.install.refreshConfig(row.data.config);
  if (refreshed.expiresAt === row.data.config.expiresAt) {
    return { config: refreshed, rotated: false };
  }

  const updated = await userSkillsRepo.updateData(
    row.user_id,
    row.id,
    { skill_id: row.data.skill_id, config: refreshed } as InstallableSkillConfig,
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
