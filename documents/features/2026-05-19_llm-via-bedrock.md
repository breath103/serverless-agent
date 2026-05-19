# LLM transport: Anthropic API → AWS Bedrock

**Issue:** [#14](https://github.com/breath103/serverless-agent/issues/14)
**Branch:** `feat/llm-via-bedrock`
**Date:** 2026-05-19

## Problem

The agent runtime calls Claude through the Anthropic API, which means every environment needs a long-lived `ANTHROPIC_API_KEY` in env vars — local `.env.development`, deployed Lambda env, the gitignored `.env.production`. That's a static secret outside the AWS-native auth surface we already use for everything else (DynamoDB, S3, IoT, IAM). Same goes for the unused `OPENAI_API_KEY` left over from earlier experiments.

Routing Claude calls through AWS Bedrock collapses LLM auth into the Lambda execution role, removes the static API key, and centralizes audit/cost/observability in one account.

## Approach

Use `@anthropic-ai/bedrock-sdk` — Anthropic's drop-in client for Bedrock. It extends the same `BaseAnthropic` class as `@anthropic-ai/sdk`, so `messages.create`, `messages.stream(...).finalMessage()`, tool use, ephemeral `cache_control`, and the response usage fields all match. The only real differences: no API key, and Bedrock requires Geo inference-profile IDs.

No provider abstraction. The chat loop and title gen both call Bedrock directly.

### Model

**`global.anthropic.claude-opus-4-7`** for both chat loop and title gen — verified live with `@anthropic-ai/bedrock-sdk`.

Why one model for both:
- Opus 4.7 is Bedrock's current latest. Released Apr 16, 2026. Opus 4.6 (Anthropic API alias) was never published on Bedrock; the lineup goes 4.5 → 4.7.
- Title gen is fire-and-forget on a 64-token output, so the cost delta between Opus and Haiku is dollars per thousand chats — irrelevant for a demo, and removes a second Bedrock approval from the deploy path.

Why **Global** (`global.*`), not **Geo** (`us.*`):
- Bedrock requires an inference profile for these models — calling bare `anthropic.claude-opus-4-7` returns *"Invocation … with on-demand throughput isn't supported."*
- A Geo profile (`us.*`) only accepts calls from a fixed set of source regions (us-east-1/us-east-2/us-west-1/us-west-2/ca-central-1/ca-west-1). Local dev from a developer whose AWS profile defaults to a non-US region would fail.
- A Global profile routes from every Bedrock-supported region. The SDK can resolve its region from any chain (Lambda runtime env, `~/.aws/config`, etc.) and the call still lands. **No `awsRegion` hardcode needed on the client.**

IAM (in `backend-stack.ts`) grants `bedrock:InvokeModel` + `InvokeModelWithResponseStream` on two ARN patterns — the Global inference profile (account-scoped) and the underlying foundation model (account-agnostic, fanned out cross-region by the profile):
```
arn:aws:bedrock:*:${account}:inference-profile/global.anthropic.*
arn:aws:bedrock:*::foundation-model/anthropic.*
```

### Code changes (file by file)

- `packages/backend/src/agent-runtime/anthropic.ts` — replaced the `AnthropicClient` class (no instance state, no test mocks) with a module-level `client` singleton and an exported `chat()` free function. The SDK instance is constructed once per Lambda container instead of per chat turn — warm-container HTTPS keep-alive carries over. Also dropped the unused `LlmUsage` / `PRICING` / cost-tracking shape: `orchestrate.ts` only reads `message`, so `chat()` returns `LlmAssistantMessage` directly.
- `packages/backend/src/agent-runtime/generate-chat-title.ts` — same SDK swap. SDK hoisted to module scope to match `anthropic.ts`.
- `packages/backend/src/agent-runtime/orchestrate.ts` — `const { message } = await anthropic.chat(...)` → `const message = await chat(...)`.
- `packages/backend/scripts/lib/backend-stack.ts` — inline `bedrock:InvokeModel` + `InvokeModelWithResponseStream` `PolicyStatement` on both Lambdas. Resources cover the inference-profile ARN (account-scoped, `us.anthropic.*`) and the underlying foundation-model ARN (account-agnostic).
- `packages/backend/src/env.d.ts` — removed `ANTHROPIC_API_KEY`.
- `packages/backend/.env.sample` — dropped the LLM-key block.
- `packages/backend/.env.development`, `.env.production` (gitignored) — stripped `ANTHROPIC_API_KEY` + `OPENAI_API_KEY`.
- `packages/backend/package.json` — added `@anthropic-ai/bedrock-sdk@^0.29.1`. Kept `@anthropic-ai/sdk` — it's a direct dep of bedrock-sdk and supplies shared types (`MessageParam`, `TextBlockParam`, `ToolUseBlockParam`, `ToolResultBlockParam`).

### Auth model

| Environment | Credentials |
|---|---|
| Local dev | `~/.aws/credentials` / `AWS_PROFILE` from the existing chain. No region setup needed — the Global profile routes from any region the SDK resolves. |
| Lambda (prod) | Execution role, scoped by the inline Bedrock IAM statement. |

## Operator pre-deploy checklist

1. **Anthropic use-case form** — *AWS Console → Bedrock → Model access*: enable **Claude Opus 4.7** for the deploying account. New accounts have to fill the Anthropic intake form once; approval is usually ~15 min. Without it Bedrock returns `Model use case details have not been submitted for this account`.
2. **Verify with a real Bedrock call**:
   ```bash
   ./.tmp/bedrock-smoke.ts
   ```
   `global.anthropic.claude-opus-4-7` should return `OK`.

## Non-goals

- No provider abstraction. Bedrock is the only target.
- No changes to prompt caching, tool-use shape, or `orchestrate.ts` chat-loop logic beyond the call-site rename.
- No removal of `@anthropic-ai/sdk` from `package.json` — bedrock-sdk depends on it.

## Risk / tradeoffs

- **Opus 4.7 dropped `temperature` / `top_p` / `top_k`** — we don't set any of them, so this is fine. Only matters if the chat loop ever wants to tune sampling.
- **`thinking.type: "adaptive"` only** — we don't use extended thinking, so this is fine. If someone wires it up later, `"enabled"` with `budget_tokens` will 400.
- **One Bedrock approval covers everything** — if you later split title gen back onto Haiku, you'll need to enable that model separately in the Bedrock console.
