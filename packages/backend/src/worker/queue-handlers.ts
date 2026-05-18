import { endGenerating } from "../agent-runtime/lifecycle.js";
import { runChatTurn } from "../agent-runtime/orchestrate.js";
import type { WorkerPayload } from "../types/queue-message.js";
import { refreshAllUserSkills } from "./refresh-user-skills.js";

const handlers: {
  [K in WorkerPayload["type"]]: (payload: Extract<WorkerPayload, { type: K }>) => Promise<void>;
} = {
  cron_tick: async () => {
    await refreshAllUserSkills();
  },
  run_chat: async ({ userId, sessionId }) => {
    try {
      await runChatTurn({ userId, sessionId });
    } finally {
      await endGenerating(sessionId, userId);
    }
  },
};

export async function handleWorkerPayload(payload: WorkerPayload): Promise<void> {
  // TS can't correlate `payload.type` with the indexed handler's param type
  // here; the discriminated union still guarantees the right handler runs.
  await (handlers[payload.type] as (p: WorkerPayload) => Promise<void>)(payload);
}
