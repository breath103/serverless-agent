#!/usr/bin/env -S node --import tsx
/**
 * Seed a fake user_skills row for the dev-admin user — drives `userSkillsRepo.upsert`
 * with synthetic OAuth tokens so the frontend connected-state can be exercised
 * locally without a real Google round-trip.
 *
 * Usage:  ./packages/backend/scripts/seed_user_skill.ts [skillId]
 *   - [skillId]:   default `google-calendar`
 *
 * Idempotent — `upsert` dedupes on (user_id, skill_id), so re-running just
 * refreshes the synthetic tokens.
 */
import { loadEnv } from "./lib/env.js";

loadEnv("development");

import type { InstallableSkillId } from "../src/skills/index.js";
import { userSkillsRepo } from "../src/skills/user-skills-repository.js";
import { usersRepo } from "../src/users/users-repository.js";
import { DEV_ADMIN_USER_ID } from "./lib/dev-auth.js";

async function main(): Promise<void> {
  const skillId = (process.argv[2] ?? "google-calendar") as InstallableSkillId;

  const user = await usersRepo.getById(DEV_ADMIN_USER_ID);
  if (!user) {
    console.error("dev-admin user not found — run `npm run -w backend ddb:bootstrap` first");
    process.exit(1);
  }

  const row = await userSkillsRepo.upsert({
    userId: user.id,
    skillId,
    config: {
      accessToken: "ya29.fake-access-token",
      refreshToken: "1//fake-refresh-token",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      email: "admin@example.invalid",
      name: "Admin (seeded)",
    },
  });
  console.log(`seeded ${skillId} for dev-admin: ${row.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
