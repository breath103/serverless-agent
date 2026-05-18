import type { WorkerPayload } from "../types/queue-message.js";
import { cronTick } from "./handlers/cron-tick.js";
import { runChat } from "./handlers/run-chat.js";

const handlers: {
  [K in WorkerPayload["type"]]: (payload: Extract<WorkerPayload, { type: K }>) => Promise<void>;
} = {
  cron_tick: cronTick,
  run_chat: runChat,
};

export async function handleWorkerPayload(payload: WorkerPayload): Promise<void> {
  // TS can't correlate `payload.type` with the indexed handler's param type
  // here; the discriminated union still guarantees the right handler runs.
  await (handlers[payload.type] as (p: WorkerPayload) => Promise<void>)(payload);
}
