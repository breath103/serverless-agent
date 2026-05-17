# Async-Lambda chat loop

**Issue:** [#11](https://github.com/breath103/serverless-agent/issues/11)
**Branch:** `fix/chat-loop-async-lambda-invoke`
**Date:** 2026-05-17

## Problem

Production chat sessions get stuck with `chat_sessions.is_generating = true` forever.

The chat loop runs as a dangling promise (`void (async () => { … })()`) after the HTTP response is returned. In Lambda, the container is frozen the moment the response goes out — the `finally` block that flips `is_generating` back to `false` doesn't reliably run. Subsequent polling invocations partially advance the frozen promise, which is why the assistant message eventually lands in DynamoDB, but the cleanup write almost never makes it.

Evidence from session `1a0a6660-…`:
- User message saved at `06:24:01`
- Session `updated_at = 06:24:03` (from `beginGenerating`)
- Assistant message saved at `06:27:25` (chat loop made partial progress over multiple invocations)
- Session `is_generating: true` (the `endGenerating` write never landed)
- No errors in Lambda logs

The author of `runChatInBackground` already documented this in the file:

> *"In local dev this works trivially (long-running Node process). In Lambda production, dangling promises may not complete after the handler returns — when we wire prod, swap this to an async Lambda invoke (same pattern as `enqueueToAgents`)."*

This issue wires the prod path the comment hints at.

## Approach

Pattern is copied verbatim from Pensieve-1, which uses a single Worker Lambda that accepts a discriminated-union payload (`cron_tick` from EventBridge, `run_chat` from the API). The API Lambda async-invokes the Worker with `InvocationType: "Event"` and returns immediately. The Worker runs each task in its own execution with its own timeout — no dangling promises.

This repo already has a Worker Lambda (`packages/backend/scripts/lib/backend-stack.ts` Worker construct), currently triggered only by `RefreshUserSkillsSchedule`. We extend it rather than create a third Lambda.

### Flow

```
HTTP POST /api/chat-sessions
        │
        ▼
API Lambda  ──── chat_sessions.put({ is_generating: true })
        │
        │  invokeAsyncLambda({ type: "run_chat", userId, sessionId })
        │  (returns immediately, HTTP response goes out)
        ▼
Worker Lambda  ── chatLoop(opts)  ── … LLM turn, MQTT publishes, etc.
        │       └── finally { endGenerating } ✅ runs synchronously
        ▼
chat_sessions.put({ is_generating: false })
```

EventBridge still fires `cron_tick` payloads at the same Worker, dispatched by the payload's `type`.

## File changes

### NEW

| File | Purpose |
|------|---------|
| `packages/backend/src/types/queue-message.ts` | Zod discriminated union: `{ type: "cron_tick", firedAt } \| { type: "run_chat", userId, sessionId, userMessageText }` |
| `packages/backend/src/lib/async-lambda.ts` | `invokeAsyncLambda(payload)` — wraps `LambdaClient.send(InvokeCommand({ FunctionName, InvocationType: "Event", Payload }))`. In dev (no `AGENT_WORKER_FUNCTION_NAME`), runs the worker handler inline as a fire-and-forget promise (dev backend is a long-lived Node process, so this works). |
| `packages/backend/src/worker/queue-handlers.ts` | `handleWorkerPayload(payload)` switch on `type` — calls `refreshAllUserSkills()` for `cron_tick`, `runChatTurn(...)` for `run_chat`. |

### MODIFIED

| File | Change |
|------|--------|
| `packages/backend/src/worker/handler.ts` | Stop ignoring `event`. Parse via `workerPayloadSchema`, dispatch via `handleWorkerPayload`. |
| `packages/backend/src/agent-runtime/start-chat-session.ts` | Replace `runChatInBackground(opts)` with `invokeAsyncLambda({ type: "run_chat", userId, sessionId, userMessageText })`. Delete `runChatInBackground` and its dangling-promise wrapper. The user-message insert + initial realtime publish stay in the API handler (synchronous, fast); only the LLM turn moves to the worker. |
| `packages/backend/src/agent-runtime/index.ts` | `chatLoop` no longer needs the `userMessageText` insert step (now done by API before invoke). Inline `runChatTurn` directly in `handleWorkerPayload`'s `run_chat` branch, OR keep `chatLoop` and update its semantics. **Decision: keep `chatLoop` as the worker-side entry — it just calls `runChatTurn` + `endGenerating` in finally.** Drop the user-message insert from `chatLoop`. |
| `packages/backend/scripts/lib/backend-stack.ts` | (1) Add `WorkerAlias` (alias `"live"`). (2) `workerAlias.grantInvoke(fn)` — IAM permission API→Worker. (3) `fn.addEnvironment("AGENT_WORKER_FUNCTION_NAME", workerAlias.functionArn)`. (4) Point `RefreshUserSkillsSchedule` target at `workerAlias` with `events.RuleTargetInput.fromObject({ type: "cron_tick", firedAt: events.EventField.time })` so the cron sends a real payload the new dispatcher understands. (5) Worker timeout currently 5 min — unchanged. |
| `packages/backend/src/env.d.ts` | Declare `AGENT_WORKER_FUNCTION_NAME: string \| undefined; // @cdk-injected` — undefined-friendly because local dev doesn't have one (and `invokeAsyncLambda` falls back to inline execution there). |

### DELETED

| Function | Reason |
|----------|--------|
| `runChatInBackground` in `start-chat-session.ts` | Replaced by `invokeAsyncLambda`. |

## CDK / IAM details

- **`workerAlias.grantInvoke(fn)`** is the only new IAM grant. Adds `lambda:InvokeFunction` on the alias to the API role.
- **Alias indirection** matters: the API holds the alias ARN, not the function ARN. New worker versions get aliased without rotating the env var on the API.
- **EventBridge → alias.** Switch `RefreshUserSkillsSchedule` to target `workerAlias` (not the raw function) so the cron always hits the same alias as the API invokes.

## Dev mode (no separate worker process)

`invokeAsyncLambda` checks `process.env.AGENT_WORKER_FUNCTION_NAME`. If unset:
- `NODE_ENV === "development"` → run `handleWorkerPayload(payload)` inline as `void (async () => …)().catch(console.error)`. The dev backend is a long-lived Node process, so the dangling promise *does* complete here. This keeps dev simple — no second process to babysit.
- Otherwise throw. Silent fallback to inline in prod is the bug we're fixing; we don't want to reintroduce it.

## Risks / tradeoffs

| Risk | Mitigation |
|------|------------|
| Async invoke fails silently (bad IAM, throttled, etc.). Session stays `is_generating: true`. | Per AWS docs, async-invoke failures retry up to 2× then go to DLQ. We're not adding a DLQ in this PR — note as a follow-up. For now: alarm on `Lambda.Invocations` for the worker dropping vs API rising. |
| Worker cold start adds latency on first chat after idle. | Acceptable. Existing `WarmerSchedule` covers the API Lambda; we can add a worker warmer later if cold starts are felt. **Not in scope for this PR.** |
| Long LLM turns hit the 5-min worker timeout. | Same risk that exists with current dangling-promise code. Out of scope. |
| Existing stuck rows (e.g. session `1a0a6660-…`) won't auto-recover after this lands. | Manual DDB `UpdateItem` to clear `is_generating` post-deploy. Tracked in the landing task. |

## Out of scope

- DLQ for failed worker invokes
- Worker prewarm schedule
- Title-generation fire-and-forget in `generateChatTitleInBackground` (same bug class — separate PR)
- Telegram-webhook lifecycle path that also uses `beginGenerating` directly (`routes/telegram-webhook.ts:85`) — separate PR to route it through the worker

## E2E verification plan

1. `./scripts/dev.ts start`
2. `curl -H "X-Dev-Role: user" -X POST <edge>/api/chat-sessions -d '{ "userMessageText": "hi" }'` → expect `200` with `sessionId` returned immediately (≤200ms even though LLM call takes longer).
3. Poll session: `curl -H "X-Dev-Role: user" <edge>/api/chat-sessions/<id>` → `is_generating: false` once the LLM turn completes (typically 5–30s).
4. List messages — both user + assistant present.
5. Repeat the above against the deployed prod after merge.

A focused `packages/backend/scripts/e2e_chat.ts` harness covering the above would be ideal as a follow-up. **Not adding in this PR** unless review feedback asks for it.

## References

- Bug location: `packages/backend/src/agent-runtime/start-chat-session.ts:55-69`
- Pensieve-1 pattern:
  - `packages/backend/src/lib/async-lambda.ts`
  - `packages/backend/src/types/queue-message.ts`
  - `packages/backend/src/lambda-background-worker/handler.ts`
  - `packages/backend/scripts/lib/backend-stack.ts:191-258`
