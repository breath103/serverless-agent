import { chatSessionsRepo } from "../chat-sessions/chat-sessions-repository.js";
import { publishRealtimeEvent } from "../lib/realtime-publish.js";
import type { ChatSessionKind } from "../types/database.js";
import { generateChatTitleInBackground } from "./generate-chat-title.js";
import { chatLoop } from "./index.js";
import { endGenerating } from "./lifecycle.js";

/**
 * Create a new chat session, fire the LLM turn in the background, and
 * generate a title in parallel. Returns the sessionId immediately; both
 * background tasks publish realtime events as they progress.
 *
 * `kind` discriminates user-initiated chats from system-spawned ones —
 * the UI marks `"internal"` chats with an "Auto" badge so users can tell
 * them apart from chats they started.
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

  runChatInBackground({ userId: opts.userId, sessionId: session.id, userMessageText: opts.userMessageText });
  void generateChatTitleInBackground({
    userId: opts.userId,
    sessionId: session.id,
    userMessageText: opts.titleSeedText ?? opts.userMessageText,
  });

  return { sessionId: session.id };
}

/**
 * Fire-and-forget chatLoop. HTTP returns immediately; the LLM turn
 * runs in the background, writes rows + publishes MQTT as it goes.
 *
 * In local dev this works trivially (long-running Node process). In
 * Lambda production, dangling promises may not complete after the
 * handler returns — when we wire prod, swap this to an async Lambda
 * invoke (same pattern as `enqueueToAgents`).
 */
export function runChatInBackground(opts: {
  userId: string;
  sessionId: string;
  userMessageText: string;
}): void {
  void (async () => {
    try {
      await chatLoop(opts);
    } catch (err) {
      console.error("[chatLoop] failed", err);
    } finally {
      await endGenerating(opts.sessionId, opts.userId);
    }
  })();
}
