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

### Why single-region foundation IDs, not cross-region inference profiles

Bedrock offers two ways to reach a Claude model:

| Style | Model ID | Resource ARN |
|---|---|---|
| Single-region foundation model | `anthropic.claude-opus-4-6-20251008-v1:0` | `arn:aws:bedrock:us-east-1::foundation-model/...` |
| US cross-region inference profile | `us.anthropic.claude-opus-4-6-20251008-v1:0` | adds `inference-profile/*` to IAM, routes across us-east-1/us-east-2/us-west-2 for capacity |

The demo runs single-region in `us-east-1` and the workload is tiny — capacity routing isn't worth the extra IAM surface and the operational gotcha of the inference-profile ARN. If we hit throttles later, the switch is one-character ID change plus an extra `inference-profile/*` resource pattern on the Bedrock IAM statement.

### File changes

- `packages/backend/src/agent-runtime/anthropic.ts` — replaced the `AnthropicClient` class (which had no real instance state) with a module-level `client` singleton and an exported `chat()` free function. The SDK instance is constructed once per Lambda container instead of once per chat turn — warm-container HTTPS keep-alive carries over. `MODEL` constant: `claude-opus-4-6` → `anthropic.claude-opus-4-6-20251008-v1:0`. Also dropped the unused `LlmUsage` / `PRICING` / cost-tracking shape: `orchestrate.ts` only reads `message`, so `chat()` now returns `LlmAssistantMessage` directly.
- `packages/backend/src/agent-runtime/generate-chat-title.ts` — same SDK swap. Model: `claude-haiku-4-5` → `anthropic.claude-haiku-4-5-20251001-v1:0`. SDK hoisted to module scope to match `anthropic.ts`.
- `packages/backend/src/agent-runtime/orchestrate.ts` — `const { message } = await anthropic.chat(...)` → `const message = await chat(...)`.
- `packages/backend/scripts/lib/backend-stack.ts` — add `bedrock:InvokeModel` + `bedrock:InvokeModelWithResponseStream` inline `PolicyStatement` on `arn:aws:bedrock:*::foundation-model/anthropic.*` to both the API Lambda and Worker Lambda roles (matches the inline `iot:Publish` style already in the file).
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

1. **Bedrock model access** — *AWS Console → Bedrock (us-east-1) → Model access* must have the Anthropic Claude models enabled. New accounts have to request access; one-time per-account toggle.
2. **Exact model IDs are live in us-east-1**:
   ```bash
   aws bedrock list-foundation-models --region us-east-1 \
     --query 'modelSummaries[?contains(modelId,`claude-opus-4-6`) || contains(modelId,`claude-haiku-4-5`)].modelId'
   ```
   Update the `MODEL` constants in `anthropic.ts` and `generate-chat-title.ts` if the dates differ from what's published.

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
