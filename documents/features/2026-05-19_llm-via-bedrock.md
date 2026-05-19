# LLM transport: Anthropic API → AWS Bedrock

**Issue:** [#14](https://github.com/breath103/serverless-agent/issues/14)
**Branch:** `feat/llm-via-bedrock`
**Date:** 2026-05-19

## Problem

The agent runtime calls Claude through the Anthropic API, which means every environment needs a long-lived `ANTHROPIC_API_KEY` in env vars — local `.env.development`, deployed Lambda env, the gitignored `.env.production`. That's a static secret outside the AWS-native auth surface we already use for everything else (DynamoDB, S3, IoT, IAM). Same goes for the unused `OPENAI_API_KEY` left over from earlier experiments.

Routing Claude calls through AWS Bedrock collapses LLM auth into the Lambda execution role, removes the static API key, and centralizes audit/cost/observability in one account.

## Approach

Use `@anthropic-ai/bedrock-sdk` — Anthropic's drop-in client for Bedrock. It extends the same `BaseAnthropic` class as `@anthropic-ai/sdk`, so `messages.create`, `messages.stream(...).finalMessage()`, tool use, ephemeral `cache_control`, and the response usage fields all match. The only real differences: no API key, and Bedrock pins date-stamped model IDs instead of the Anthropic API's version-floating aliases.

No provider abstraction. `AnthropicClient` stays Anthropic/Bedrock-specific.

### Model IDs and inference profiles

Bedrock **requires** US cross-region inference profiles (`us.anthropic.*`) for both Claude 4-series models we use — calling the bare foundation IDs returns *"Invocation of model ID … with on-demand throughput isn't supported. Retry your request with the ID or ARN of an inference profile."* Verified against live Bedrock in `us-east-1`.

Models in use (Bedrock-verified, 2026-05):
- Chat loop: `us.anthropic.claude-opus-4-5-20251101-v1:0` — Bedrock's latest Opus. **Note: Claude Opus 4.6 exists on the Anthropic API but is not on Bedrock yet.** Opus 4.5 is the closest match.
- Title gen: `us.anthropic.claude-haiku-4-5-20251001-v1:0`

IAM (in `backend-stack.ts`) grants `bedrock:InvokeModel` + `InvokeModelWithResponseStream` on two ARN patterns — the inference profile (account-scoped) and the underlying foundation model (account-agnostic; cross-region inference fans out to peer-region foundation models):
```
arn:aws:bedrock:*:${account}:inference-profile/us.anthropic.*
arn:aws:bedrock:*::foundation-model/anthropic.*
```

### File changes

- `packages/backend/src/agent-runtime/anthropic.ts` — replaced the `AnthropicClient` class (which had no real instance state) with a module-level `client` singleton and an exported `chat()` free function. The SDK instance is constructed once per Lambda container instead of once per chat turn — warm-container HTTPS keep-alive carries over. `MODEL` constant: `claude-opus-4-6` → `us.anthropic.claude-opus-4-5-20251101-v1:0` (Bedrock's latest Opus; see "Model IDs and inference profiles" above). Also dropped the unused `LlmUsage` / `PRICING` / cost-tracking shape: `orchestrate.ts` only reads `message`, so `chat()` now returns `LlmAssistantMessage` directly.
- `packages/backend/src/agent-runtime/generate-chat-title.ts` — same SDK swap. Model: `claude-haiku-4-5` → `us.anthropic.claude-haiku-4-5-20251001-v1:0`. SDK hoisted to module scope to match `anthropic.ts`.
- `packages/backend/src/agent-runtime/orchestrate.ts` — `const { message } = await anthropic.chat(...)` → `const message = await chat(...)`.
- `packages/backend/scripts/lib/backend-stack.ts` — add `bedrock:InvokeModel` + `bedrock:InvokeModelWithResponseStream` inline `PolicyStatement` to both the API Lambda and Worker Lambda roles. Resources cover both the inference-profile ARN (account-scoped, `us.anthropic.*`) and the underlying foundation-model ARN (account-agnostic, used cross-region by the inference profile).
- `packages/backend/src/env.d.ts` — remove `ANTHROPIC_API_KEY`.
- `packages/backend/.env.sample` — drop the LLM-key block.
- `packages/backend/.env.development`, `.env.production` (gitignored) — strip `ANTHROPIC_API_KEY` + `OPENAI_API_KEY`.
- `packages/backend/package.json` — add `@anthropic-ai/bedrock-sdk@^0.29.1`. Keep `@anthropic-ai/sdk` — it's a direct dep of bedrock-sdk and supplies shared types (`MessageParam`, `TextBlockParam`, `ToolUseBlockParam`, `ToolResultBlockParam`).

### Auth model

| Environment | Credentials |
|---|---|
| Local dev | `~/.aws/credentials` / `AWS_PROFILE` from the existing chain (same one used for DynamoDB, S3, IoT). No new env var. |
| Lambda (prod) | Execution role, scoped by the inline Bedrock IAM statement. |

## Operator pre-deploy checklist

1. **Anthropic use-case form** — *AWS Console → Bedrock (us-east-1) → Model access*: each Anthropic Claude model on Bedrock is gated behind a one-time per-account use-case form (request access → fill the Anthropic intake → wait for approval, usually ~15 minutes). Both Opus 4.5 and Haiku 4.5 must show "Access granted" before the deploy runs. The Bedrock API surfaces the missing-form case as: *"Model use case details have not been submitted for this account."*
2. **Verify the inference profile resolves** in `us-east-1`. Smoke test against your own credentials:
   ```bash
   AWS_REGION=us-east-1 ./.tmp/bedrock-smoke.ts   # or any equivalent test invoke
   ```
   Both `us.anthropic.claude-opus-4-5-20251101-v1:0` and `us.anthropic.claude-haiku-4-5-20251001-v1:0` should return `OK`. If Bedrock updates either model to a newer dated revision, swap the `MODEL` constants in `anthropic.ts` and `generate-chat-title.ts`.

## Verification

- Full backend + frontend CI parity locally (typecheck + lint + test).
- End-to-end: `./scripts/dev.ts start` → sign in as dev user → POST `/api/chat` with a fresh session → poll `current_run_id == null` → read the messages and confirm the agent responded. Both Opus (chat loop) and Haiku (title gen on first user message) get exercised.

## Non-goals

- No provider abstraction. Bedrock is the only target.
- No model upgrade. Same Opus 4.6 / Haiku 4.5 as today.
- No changes to prompt caching, tool-use shape, or `orchestrate.ts` chat-loop logic.
- No removal of `@anthropic-ai/sdk` from `package.json` — bedrock-sdk depends on it.

## Risk / tradeoffs

- **Latency / throttling**: single-region calls don't get the cross-region failover that inference profiles provide. For this demo's traffic, that's fine; the migration path is documented above.
