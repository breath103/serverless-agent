import { z } from "zod";

// Payloads accepted by the background Worker Lambda. The Worker is async-invoked
// (`InvocationType: "Event"`) from the API via `lib/async-lambda.ts`, and as
// EventBridge cron target. No SQS — the API fires the invoke and returns; the
// Worker runs each task in its own execution with its own timeout.
export const workerPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("cron_tick"), firedAt: z.string() }),
  z.object({
    type: z.literal("run_chat"),
    userId: z.string(),
    sessionId: z.string(),
  }),
]);

export type WorkerPayload = z.infer<typeof workerPayloadSchema>;
