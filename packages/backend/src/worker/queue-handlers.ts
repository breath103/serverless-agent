import { endGenerating } from "../agent-runtime/lifecycle.js";
import { runChatTurn } from "../agent-runtime/orchestrate.js";
import type { WorkerPayload } from "../types/queue-message.js";
import { refreshAllUserSkills } from "./refresh-user-skills.js";

export async function handleWorkerPayload(payload: WorkerPayload): Promise<void> {
  switch (payload.type) {
    case "cron_tick":
      await refreshAllUserSkills();
      return;
    case "run_chat":
      try {
        await runChatTurn({ userId: payload.userId, sessionId: payload.sessionId });
      } finally {
        await endGenerating(payload.sessionId, payload.userId);
      }
      return;
  }
}
