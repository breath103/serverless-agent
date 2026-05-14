import { chatSessionsRepo } from "../chat-sessions/chat-sessions-repository.js";
import { publishRealtimeEvent } from "../lib/realtime-publish.js";

/**
 * Atomically flip is_generating false → true for a session owned by
 * this user. Returns the session row on success, null if the session
 * is already generating / not found / not owned.
 */
export async function beginGenerating(sessionId: string, userId: string) {
  const data = await chatSessionsRepo.beginGenerating(userId, sessionId);
  if (data) {
    await publishRealtimeEvent(userId, { type: "entity_update", table: "chat_sessions", op: "upsert", row: data });
  }
  return data;
}

/** Flip is_generating back to false. Safe to call even if already false. */
export async function endGenerating(sessionId: string, userId: string): Promise<void> {
  const data = await chatSessionsRepo.endGenerating(userId, sessionId);
  await publishRealtimeEvent(userId, { type: "entity_update", table: "chat_sessions", op: "upsert", row: data });
}
