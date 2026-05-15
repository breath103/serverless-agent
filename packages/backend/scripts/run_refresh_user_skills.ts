#!/usr/bin/env -S node --import tsx
/**
 * Manually invoke the user-skills refresh worker. EventBridge fires the
 * same code on `rate(30 min)` in production; locally there's no scheduler,
 * so use this to exercise the path on demand.
 */
import { loadEnv } from "./lib/env.js";

loadEnv("development");

import { refreshAllUserSkills } from "../src/worker/refresh-user-skills.js";

async function main(): Promise<void> {
  const stats = await refreshAllUserSkills();
  console.log(JSON.stringify(stats));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
