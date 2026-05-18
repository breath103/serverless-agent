import { refreshAllUserSkills } from "../refresh-user-skills.js";

export async function cronTick(): Promise<void> {
  await refreshAllUserSkills();
}
