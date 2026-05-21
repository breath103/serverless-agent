/// <reference types="aws-lambda" />

import { posthog } from "../lib/posthog.js";
import { workerPayloadSchema } from "../types/queue-message.js";
import { handleWorkerPayload } from "./queue-handlers.js";

// Async-invoked Worker Lambda. Receives a plain JSON payload from
// `invokeAsyncLambda` (API Lambda) or EventBridge (cron). No SQS — each
// invoke runs in its own execution with its own timeout.
// eslint-disable-next-line @typescript-eslint/no-restricted-types
export async function handler(event: unknown): Promise<void> {
  try {
    const payload = workerPayloadSchema.parse(event);
    await handleWorkerPayload(payload);
  } finally {
    // shutdown() waits for pending capture() promises before flushing.
    await posthog?.shutdown();
  }
}
