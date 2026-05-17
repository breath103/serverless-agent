import { chatLoop } from "../agent-runtime/index.js";
import type { WorkerPayload } from "../types/queue-message.js";
import { refreshAllUserSkills } from "./refresh-user-skills.js";

export async function handleWorkerPayload(payload: WorkerPayload): Promise<void> {
  switch (payload.type) {
    case "cron_tick":
      await refreshAllUserSkills();
      return;
    case "run_chat":
      await chatLoop({ userId: payload.userId, sessionId: payload.sessionId });
      return;
  }
}
