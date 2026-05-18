import { endGenerating } from "../../agent-runtime/lifecycle.js";
import { runChatTurn } from "../../agent-runtime/orchestrate.js";
import type { WorkerPayload } from "../../types/queue-message.js";

export async function runChat({ userId, sessionId }: Extract<WorkerPayload, { type: "run_chat" }>): Promise<void> {
  try {
    await runChatTurn({ userId, sessionId });
  } finally {
    await endGenerating(sessionId, userId);
  }
}
