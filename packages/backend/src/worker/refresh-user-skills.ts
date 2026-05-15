import { refreshAndPersist } from "../skills/refresh.js";
import { userSkillsRepo } from "../skills/user-skills-repository.js";

/**
 * Iterate every row in the user_skills table and refresh-and-persist each.
 * Designed to run as a cron Lambda — `rate(30 minutes)` keeps every row's
 * access token well inside its 1-hour Google-issued lifetime, even for
 * users who never trigger a chat.
 *
 * Per-row errors (e.g. revoked tokens) are logged and the loop continues —
 * one bad row must not halt the whole sweep. The row stays in DDB on
 * failure; the next user-driven action surfaces the same `invalid_grant`
 * via the existing route handlers, and the UI prompts a reconnect.
 */
export async function refreshAllUserSkills(): Promise<{ scanned: number; refreshed: number; failed: number }> {
  const rows = await userSkillsRepo.scanAll();
  let refreshed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const { rotated } = await refreshAndPersist(row);
      if (rotated) refreshed++;
    } catch (err) {
      failed++;
      console.error(
        `[refresh-user-skills] user=${row.user_id} skill=${row.data.skill_id} id=${row.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(`[refresh-user-skills] scanned=${rows.length} refreshed=${refreshed} failed=${failed}`);
  return { scanned: rows.length, refreshed, failed };
}
