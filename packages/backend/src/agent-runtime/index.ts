import { endGenerating } from "./lifecycle.js";
import { runChatTurn } from "./orchestrate.js";

// Worker-side entry. Runs one assistant turn and ALWAYS flips
// `chat_sessions.is_generating` back to false on the way out — the whole
// reason this function exists is so the cleanup runs synchronously inside
// the Worker's Lambda execution rather than as a dangling promise on the
// API handler that Lambda freezes before the `finally` fires.
export async function chatLoop(opts: { userId: string; sessionId: string }): Promise<void> {
  try {
    await runChatTurn({ userId: opts.userId, sessionId: opts.sessionId });
  } finally {
    await endGenerating(opts.sessionId, opts.userId);
  }
}

export { beginGenerating } from "./lifecycle.js";
