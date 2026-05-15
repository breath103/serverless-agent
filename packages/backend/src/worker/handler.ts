/// <reference types="aws-lambda" />

import { refreshAllUserSkills } from "./refresh-user-skills.js";

/**
 * EventBridge-driven Lambda. Today the only schedule is the user-skills
 * refresh sweep; add a `detail.type` discriminator on the event when a
 * second cron job lands.
 */
export async function handler(): Promise<void> {
  await refreshAllUserSkills();
}
