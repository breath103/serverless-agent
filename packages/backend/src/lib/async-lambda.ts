import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

import type { WorkerPayload } from "../types/queue-message.js";
import { handleWorkerPayload } from "../worker/queue-handlers.js";

const lambda = new LambdaClient({});

// Async-invoke the Worker Lambda and return as soon as Lambda accepts the
// request. The Worker runs in its own execution with its own timeout — no
// dangling promise on the caller.
//
// Local dev has no Worker process. The dev backend is a long-lived Node
// process, so running the handler inline as a void promise works correctly
// (the original bug only manifests on Lambda's frozen-container lifecycle).
// In prod we throw if the function name is missing — silent fallback would
// reintroduce the very bug this module exists to fix.
export async function invokeAsyncLambda(payload: WorkerPayload): Promise<void> {
  const functionName = process.env.AGENT_WORKER_FUNCTION_NAME;
  if (!functionName) {
    if (process.env.NODE_ENV !== "development") {
      throw new Error("AGENT_WORKER_FUNCTION_NAME is not set — worker invokes will not run");
    }
    void handleWorkerPayload(payload).catch((err) => {
      console.error(`[async-lambda dev] ${payload.type} failed`, err);
    });
    return;
  }

  await lambda.send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: "Event",
    Payload: Buffer.from(JSON.stringify(payload)),
  }));
}
