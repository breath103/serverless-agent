#!/usr/bin/env -S node --import tsx
/**
 * Seed a fake user_skills row for a given user — drives `userSkillsRepo.upsert`
 * with synthetic OAuth tokens so the frontend connected-state can be exercised
 * locally without a real Google round-trip.
 *
 * Usage:  ./packages/backend/scripts/seed_user_skill.ts <username> [skillId]
 *   - <username>:  e.g. `admin`
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

async function main(): Promise<void> {
  const username = process.argv[2];
  const skillId = (process.argv[3] ?? "google-calendar") as InstallableSkillId;
  if (!username) {
    console.error("usage: seed_user_skill.ts <username> [skillId]");
    process.exit(1);
  }

  const user = await usersRepo.getByUsername(username);
  if (!user) {
    console.error(`user not found: ${username}`);
    process.exit(1);
  }

  const row = await userSkillsRepo.upsert({
    userId: user.id,
    skillId,
    config: {
      accessToken: "ya29.fake-access-token",
      refreshToken: "1//fake-refresh-token",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      email: `${username}@example.invalid`,
      name: `${username} (seeded)`,
    },
  });
  console.log(`seeded ${skillId} for ${username}: ${row.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
