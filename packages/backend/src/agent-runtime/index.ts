import { chatSessionsRepo } from "../chat-sessions/chat-sessions-repository.js";
import { publishRealtimeEvent } from "../lib/realtime-publish.js";
import { runChatTurn } from "./orchestrate.js";

/**
 * Public entry for the chat loop.
 *
 * 1. Inserts the user message as a new chat_session_message row.
 * 2. Kicks the assistant turn (LLM + tool loop) via `runChatTurn`.
 *
 * Called from HTTP handler — typically inside a try/finally that flips
 * `chat_sessions.is_generating` back to false on the way out.
 */
export async function chatLoop(opts: {
  userId: string;
  sessionId: string;
  userMessageText: string;
}): Promise<void> {
  await insertUserMessage(opts);
  await runChatTurn({ userId: opts.userId, sessionId: opts.sessionId });
}

async function insertUserMessage(opts: {
  userId: string;
  sessionId: string;
  userMessageText: string;
}): Promise<void> {
  const row = await chatSessionsRepo.insertMessage(opts.sessionId, {
    role: "user",
    content: { kind: "text", text: opts.userMessageText },
  });
  await publishRealtimeEvent(opts.userId, { type: "entity_update", table: "chat_session_messages", op: "upsert", row });
}

export { beginGenerating } from "./lifecycle.js";
