import { chatSessionsRepo } from "../chat-sessions/chat-sessions-repository.js";
import { invokeAsyncLambda } from "../lib/async-lambda.js";
import { publishRealtimeEvent } from "../lib/realtime-publish.js";
import type { ChatSessionKind } from "../types/database.js";
import { generateChatTitleInBackground } from "./generate-chat-title.js";

/**
 * Create a new chat session, append the user message, and async-invoke the
 * Worker Lambda to run the assistant turn. Returns the sessionId immediately;
 * the Worker publishes realtime events as it goes.
 *
 * `kind` discriminates user-initiated chats from system-spawned ones — the
 * UI marks `"internal"` chats with an "Auto" badge so users can tell them
 * apart from chats they started.
 *
 * `titleSeedText` overrides the input handed to title-gen. Useful when the
 * actual user message is highly directive ("Please do X, Y, Z"), which
 * confuses haiku into producing meta-replies instead of a topic title. Pass
 * a clean topic phrase here (e.g. the memory title) to get a sensible title.
 */
export async function startChatSession(opts: {
  userId: string;
  kind: ChatSessionKind;
  userMessageText: string;
  titleSeedText?: string;
}): Promise<{ sessionId: string }> {
  const session = await chatSessionsRepo.createGenerating(opts.userId, opts.kind);
  await publishRealtimeEvent(opts.userId, {
    type: "entity_update",
    table: "chat_sessions",
    op: "upsert",
    row: session,
  });

  await continueChatSession({ userId: opts.userId, sessionId: session.id, userMessageText: opts.userMessageText });
  void generateChatTitleInBackground({
    userId: opts.userId,
    sessionId: session.id,
    userMessageText: opts.titleSeedText ?? opts.userMessageText,
  });

  return { sessionId: session.id };
}

/**
 * Append a user message and async-invoke the Worker Lambda to run the
 * assistant turn. Caller is responsible for `beginGenerating` on the session.
 */
export async function continueChatSession(opts: {
  userId: string;
  sessionId: string;
  userMessageText: string;
}): Promise<void> {
  const row = await chatSessionsRepo.insertMessage(opts.sessionId, {
    role: "user",
    content: { kind: "text", text: opts.userMessageText },
  });
  await publishRealtimeEvent(opts.userId, {
    type: "entity_update",
    table: "chat_session_messages",
    op: "upsert",
    row,
  });
  await invokeAsyncLambda({ type: "run_chat", userId: opts.userId, sessionId: opts.sessionId });
}
