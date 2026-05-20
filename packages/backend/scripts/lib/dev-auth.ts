import { randomBytes } from "node:crypto";

import { SESSION_TTL_MS } from "../../src/auth/index.js";
import { sessionsRepo } from "../../src/auth/sessions-repository.js";

export const DEV_ADMIN_USER_ID = "dev-admin";

export async function devSignIn(userId: string): Promise<string> {
  const sessionId = randomBytes(32).toString("hex");
  await sessionsRepo.create({
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return `sa_session=${sessionId}`;
}
