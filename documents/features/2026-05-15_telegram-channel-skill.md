# Telegram — channel-style skill

**Status:** proposed
**Issue:** [#5 — Telegram as a channel-style skill (bidirectional mirror)](https://github.com/breath103/serverless-agent/issues/5)
**Date:** 2026-05-15
**Prior art:** `documents/features/2026-05-15_google-calendar-skill.md` — establishes the per-user `user_skills` row, install/uninstall hooks, and the `InstallableSkillConfig` tagged-union pattern. This doc reuses that foundation and adds the channel-vs-tool distinction.

---

## Problem

Today every entry in `user_skills` is **tool-style**: instantiated via `loadSkill(...)` in `agent-runtime/skills.ts`, proxy-wrapped, declared in the LLM sandbox via a `.generated.d.ts`, and called as `skill.method(...)` from inside `executeCode`.

Telegram doesn't fit that shape. It's not a tool the LLM calls — it's a **channel** that:
- ferries inbound user messages from Telegram into one of our chat sessions, and
- mirrors outbound assistant messages back to the same Telegram chat.

The chat session is the source of truth; Telegram is a one-to-one mirror. So we need:

1. A persistent **binding** between a `user_skills` row and a `chat_sessions` row.
2. An **inbound webhook** that converts Telegram Updates into chat messages.
3. An **outbound hook** that fires after the agent finishes a turn and posts the assistant text back to Telegram.
4. A way to **exclude** channel-style skills from the LLM tool list — they must never appear in the agent's sandbox declarations.

## Approach

Reuse the existing `user_skills` table and `defineSkill` abstraction. Add a new `install.type === "telegram"` variant alongside `"builtin"` and `"oauth2"`. The discriminator on `install.type` is what cleanly partitions:

- **Tool skills** (`builtin`, `oauth2`) — go through `loadSkill`, get a `.generated.d.ts`, appear in the sandbox.
- **Channel skills** (`telegram`) — skipped by `buildSkills`, no declaration, never reach the LLM. Their behaviour is driven by webhook routes and a dispatch hook in `orchestrate.ts`.

No new table. No new abstraction layer. Just one more variant + two new files (route + dispatcher) + a one-line filter in `buildSkills` + a one-call hook in `orchestrate.ts`.

### Why install.type as the discriminator (not a separate `kind: "tool" | "channel"` field)

The frontend already filters skills by `install.type` (`InstallTypeFilteredSkillMap<"oauth2">` in `skills/index.ts:30`). Adding `kind` would create two parallel discriminators that have to stay aligned. Letting `install.type` carry the channel/tool distinction keeps a single source of truth: if you want a "send-and-receive" channel skill you write `install: { type: "telegram", ... }` and the type system carries it everywhere automatically.

---

## Data shape

### `user_skills` row — new tagged variant

```ts
// In packages/backend/src/skills/telegram.ts
const TelegramSkillConfigSchema = z.object({
  bot_token: z.string(),
  telegram_chat_id: z.string().nullable(),        // their side — captured on first inbound
  chat_session_id: z.string().nullable(),         // our side — set on first inbound (or null after explicit reset)
  webhook_secret: z.string(),                     // random per-row, sent via X-Telegram-Bot-Api-Secret-Token
  bot_username: z.string().nullable(),            // captured from getMe() at install time, displayed in UI
});
```

`InstallableSkillConfig` gains a `{ skill_id: "telegram"; config: TelegramSkillConfig }` arm automatically by the existing tagged-union machinery in `skills/index.ts`.

`UserSkillRow` shape is unchanged. The discriminated union does its job.

### No new tables, no new GSIs

Inbound webhook path is `/api/telegram/webhook/:userSkillId`, so the row is fetched by `(user_id, id)` — but we don't have `user_id` in the URL.

Two options:
- **(A) Embed user_id in the URL**: `/api/telegram/webhook/:userId/:userSkillId`. Two unpredictable segments. Fetch by primary key. Cheap.
- **(B) Add a GSI on `id` alone**: lets us look up a skill row by id without knowing user_id. Costs one GSI.

Going with **(A)** — both segments are server-generated UUIDs and the user never sees the URL. The URL is what we hand to Telegram at install time. No GSI cost, no scan, two key lookups per webhook hit.

---

## Inbound flow

```
1. User starts a chat in Telegram by messaging their bot.
2. Telegram POSTs to https://<edge>/api/telegram/webhook/<userId>/<userSkillId>
   with header X-Telegram-Bot-Api-Secret-Token: <webhook_secret>
3. Backend:
   a. Looks up user_skills row by (userId, userSkillId). 404 if missing.
   b. Verifies the secret-token header matches row.data.config.webhook_secret. 401 if mismatch.
   c. Extracts { chat.id (Telegram chat), text-or-placeholder } from the Update.
   d. If row.data.config.telegram_chat_id is null OR different from update.chat.id → ignore
      (the row is bound to a specific Telegram chat after first contact).
      Edge: on the very first message, telegram_chat_id is null → store update.chat.id.
   e. If row.data.config.chat_session_id is null → create a new chat session via
      startChatSession({ userId, kind: "user", userMessageText }), then write
      back the new sessionId into the skill row. The chat is a normal user chat;
      the binding only lives on the skill row.
   f. Otherwise: append the text as a user message to the existing chat session
      and trigger runChatInBackground.
4. Return 200 OK to Telegram immediately. The agent turn runs in the background;
   when assistant text is generated, the outbound hook posts it back to Telegram.
```

### Unsupported media

Telegram Updates carry `text` for text messages, but `photo`/`video`/`voice`/`audio`/`document`/`sticker` for media. We render media as a single placeholder string and feed it to the chat session:

```
photo     → "[image] - not supported yet"
video     → "[video] - not supported yet"
voice     → "[voice message] - not supported yet"
audio     → "[audio] - not supported yet"
document  → "[document] - not supported yet"
sticker   → "[sticker] - not supported yet"
```

If a single Update has both text and media (e.g., a photo with a caption), join them: `<caption>\n[image] - not supported yet`.

The LLM sees the placeholder and replies naturally ("sorry, I can't read images yet"), which the outbound hook posts back to Telegram. No special prompting needed.

### No new `ChatSessionKind`

A chat is a chat — Telegram is just another input device. A Telegram-initiated chat gets `kind: "user"`, exactly as if the user had typed it into the web app. The user can keep going on the same chat from web OR from Telegram; nothing in the backend cares which client the latest message came through, and any assistant reply mirrors back to Telegram regardless of which side asked the question.

If we later want a "via Telegram" badge in the sidebar, it can be derived at render time by checking whether any installed Telegram skill row has `chat_session_id === thisChat.id`. That's a frontend concern, not a stored attribute. Deferring.

---

## Outbound flow

After `runChatTurn` generates an assistant **text** block, the existing `persistAssistantBlock(block)` writes the row. We add one call right after the row write, only in the `case "text"` branch:

```ts
// orchestrate.ts — case "text" inside persistAssistantBlock
await insertPart({ ... });
await dispatchAssistantTextToChannels({ userId, sessionId, text: block.text });
```

`dispatchAssistantTextToChannels`:

1. Loads `user_skills` rows for the user (already cached for the turn? — no, the rows are loaded in `buildSkills` which has its own scope. A second read per turn is fine — a few items, single Query).
2. Filters to rows where `data.skill_id === "telegram"` AND `data.config.chat_session_id === sessionId`.
3. For each match, POSTs to `https://api.telegram.org/bot<token>/sendMessage` with `{ chat_id: telegram_chat_id, text, parse_mode: "MarkdownV2" }`.
4. Per-row failures are logged + swallowed (a revoked bot token or a deleted Telegram chat must not crash the turn or affect web-UI delivery).

### Why only `text` blocks

`tool_use`/`tool_call` rows are internal agent state — sending them to Telegram would surface raw `executeCode { code: "..." }` payloads to the user, which is noise. Only `text` is user-facing prose.

### Recursion safety

User messages (role=user) are written before the agent loop starts in `runChatInBackground`. The outbound hook is in `persistAssistantBlock`, which only runs on assistant content. So inbound→outbound→inbound recursion can't happen by construction.

### MarkdownV2 escaping

Telegram's MarkdownV2 is picky — `_`, `*`, `[`, `]`, `(`, `)`, `~`, etc. must be escaped except inside their formatting markers. Cheapest correct approach: send `parse_mode: "MarkdownV2"` with a permissive escape function that escapes everything Telegram doesn't accept literally, except the markers we want to honour. If escaping turns out flaky for a release, fall back to `parse_mode: undefined` (plain text) and lose formatting — still ships the content correctly.

---

## Excluding channel skills from the LLM

Single point of exclusion. In `agent-runtime/skills.ts`'s loop over `userSkillsRepo.listForUser(...)`:

```ts
for (const row of rows) {
  if (skillHandlers[row.data.skill_id].install.type === "telegram") continue;
  // ... existing refresh + loadSkill path
}
```

Why this is enough:
- `loadSkill` (in `skill-runtimes/index.ts`) never gets a telegram row → no runtime instance.
- No `telegram.generated.d.ts` is written → nothing for the agent's sandbox to see.
- No proxy binding → telegram methods aren't typeable inside `executeCode`.

The exhaustiveness check in `loadSkill`'s `switch` keeps working: it's exhaustive over `InstallableSkillConfig["skill_id"]` minus the channel ones we've filtered above. Adding a second channel skill (Slack, Discord) means widening the filter, not the switch.

### Type-level partition

Mirror the frontend's `Oauth2InstallSkillMap` with a sibling type:

```ts
// skills/index.ts
export type TelegramInstallSkillMap = InstallTypeFilteredSkillMap<"telegram">;
export type ChannelInstallableSkillId = keyof TelegramInstallSkillMap;
```

This lets the route handler and the dispatcher narrow to telegram skill rows without `as`.

---

## Install / uninstall

### Install — token-based, not OAuth

A new route shape, since OAuth doesn't apply:

```
POST /api/skills/install/telegram
body: { botToken: string }
```

Handler:

1. Generate `webhook_secret` (random 32 bytes hex).
2. Call `getMe` on the Telegram Bot API to verify the token and capture `bot_username`. Fail 422 with Telegram's error if invalid.
3. `userSkillsRepo.upsert({ userId, skillId: "telegram", config: { bot_token, telegram_chat_id: null, chat_session_id: null, webhook_secret, bot_username } })`.
4. Register the webhook with Telegram: `POST https://api.telegram.org/bot<token>/setWebhook { url: <edge>/api/telegram/webhook/<userId>/<userSkillId>, secret_token: webhook_secret, drop_pending_updates: true }`.
5. `publishRealtimeEvent` for the row → frontend settings page reflects connect.

Local dev: Telegram requires HTTPS, so `setWebhook` from `localhost:6001` will be rejected. Two carve-outs:

- **(a) Skip auto-`setWebhook` when `NODE_ENV === "development"`**, and log the URL the user should register manually via ngrok / cloudflare tunnel. The e2e harness simulates Telegram by hitting the local webhook URL directly — no real Telegram round-trip needed.
- **(b)** A `./packages/backend/scripts/register_telegram_webhook.ts <userSkillId> <public_url>` helper so a user with a tunnel can register manually.

### Uninstall — already wired

`DELETE /api/skills/:id` already calls `handler.install.uninstall(config)` — we just implement that hook to:
1. `POST https://api.telegram.org/bot<token>/deleteWebhook`
2. Swallow errors (same pattern as Google's revoke).

The row delete is handled by the existing route logic.

---

## E2E — `packages/backend/scripts/e2e_telegram.ts`

Exercises the full inbound/outbound shape without touching real Telegram. The Telegram Bot API base URL is configurable via env (`TELEGRAM_BOT_API_BASE`, defaults to `https://api.telegram.org`). The e2e:

1. Spins up an in-process mock Telegram server on a free port (one route: `/bot:token/:method` → JSON `{ ok: true, result: ... }`). Sets `TELEGRAM_BOT_API_BASE` to that server.
2. Signs in as `admin`.
3. POST `/api/skills/install/telegram` with `{ botToken: "test-token" }`. Asserts row is created with non-null `webhook_secret`. Asserts the mock saw `getMe` + `setWebhook`.
4. Simulates Telegram inbound: POST to `/api/telegram/webhook/<userId>/<userSkillId>` with `X-Telegram-Bot-Api-Secret-Token: <secret>` and a text-message Update body. Asserts (after a short poll) that a new chat session exists for the user and is referenced in the skill row's `chat_session_id`, and that the user message appears in `listMessagesAsc`.
5. Negative: same POST without the secret header → 401. Wrong secret → 401.
6. Inbound with a `photo` Update (no text) — asserts the user message text is `"[image] - not supported yet"`.
7. Agent generation: the e2e bypasses real Anthropic (which is slow + costs money). Either (a) stub the agent's `chat()` to immediately yield a one-block text message, or (b) directly call `dispatchAssistantTextToChannels({ userId, sessionId, text: "hello from agent" })`. (b) is simpler and tests the surface we own; the LLM call path is already covered by `e2e_skill` for Google. Going with (b).
8. Asserts the mock Telegram server received `sendMessage` with the captured `telegram_chat_id` and the assistant text.
9. DELETE `/api/skills/:id` → asserts mock saw `deleteWebhook`, asserts row gone.

Mocking discipline: only the Telegram Bot API is mocked. Webhook routing, message persistence, dispatcher logic, and the chat session lifecycle all run for real against the dev backend.

---

## Files

### Add

| File | Lines (est.) | Notes |
|---|---|---|
| `packages/backend/src/skills/telegram.ts` | ~110 | `defineSkill` with `install.type === "telegram"`, plus `getMe` / `setWebhook` / `deleteWebhook` HTTP helpers + the config schema |
| `packages/backend/src/lambda-api/routes/telegram-webhook.ts` | ~120 | Inbound webhook handler + Telegram Update zod schema |
| `packages/backend/src/channels/telegram-dispatcher.ts` | ~70 | `dispatchAssistantTextToChannels(...)`, MarkdownV2 escape, `sendMessage` HTTP call |
| `packages/backend/scripts/e2e_telegram.ts` | ~180 | E2E harness (with in-process mock Telegram server) |
| `packages/backend/scripts/register_telegram_webhook.ts` | ~25 | Dev helper for manual webhook registration over a tunnel |
| `packages/frontend/src/routes/app/dashboard/settings/skills/TelegramInstallDialog.tsx` | ~80 | Modal that prompts for bot token, calls `/api/skills/install/telegram` |

### Modify

- `packages/backend/src/skills/index.ts` — register `telegram` in `skillHandlers`; the `InstallableSkillConfig` union picks up the new variant automatically.
- `packages/backend/src/lambda-api/routes/skill.ts` — add the `POST /api/skills/install/telegram` route alongside the existing OAuth redirect/callback.
- `packages/backend/src/lambda-api/routes/index.ts` — register the telegram-webhook routes.
- `packages/backend/src/agent-runtime/skills.ts` — one-line filter to skip channel skills before `loadSkill`.
- `packages/backend/src/agent-runtime/orchestrate.ts` — call `dispatchAssistantTextToChannels` in `persistAssistantBlock`'s `case "text"` branch.
- ~~`packages/backend/src/types/database.ts`~~ — no change. A telegram-bound chat is still `kind: "user"`.
- `packages/backend/src/env.d.ts` + `.env.sample` — `TELEGRAM_BOT_API_BASE` (optional override, default `https://api.telegram.org`).
- `packages/frontend/src/routes/app/dashboard/settings/skills/SkillsPage.tsx` — render a Telegram card with a "Connect" button that opens the install dialog.
- `packages/frontend/src/routes/app/dashboard/chats/MessageBlock.tsx` — no change (channel skills produce no skill-call rows; the chat is plain text from agent's perspective).
- (Optional follow-up) `packages/frontend/.../ChatList.tsx` — show a "via Telegram" badge for chats with `kind: "external"`.

### Run

- No `generate-declarations.ts` for telegram — channel skills don't get a `.generated.d.ts`. The script must continue to work without complaining about the missing file: confirm the script's discovery already filters to `skill-runtimes/*.ts` (which Telegram doesn't have an entry in) so this is automatic.
- `npm run -w backend ddb:reset` — only needed if we end up adding a column we don't have; current plan doesn't require it.

---

## Risks / open questions

1. **Webhook URL secrecy.** `:userId/:userSkillId` are both UUIDs — non-trivial to guess, but they're bearers. The `secret_token` header is the real defence: Telegram lets you set a secret at `setWebhook` time, and refuses to call your webhook if the header doesn't match. We rely on it. An attacker who guesses both UUIDs but not the secret hits 401.
2. **Local dev requires a tunnel.** The fallback is to skip the auto-`setWebhook` step in development and let the user either run the manual helper script + ngrok, or just rely on `e2e_telegram.ts` which simulates Telegram in-process. Acceptable trade-off.
3. **Group chats and multi-bind.** A user could (today, after install) accidentally invite the bot into a group chat — first inbound would bind the row to that group. Mitigation: in step 4d above, `if (telegram_chat_id == null)` we should also assert `update.chat.type === "private"` and reject otherwise.
4. **One bot token, one row, one chat.** A user who wants two bound conversations needs two bot tokens. Out of scope; we'll know we need to lift this when someone actually asks for it.
5. **MarkdownV2 escaping fragility.** A malformed escape causes Telegram to 400 the whole send, dropping the assistant message silently. Mitigation: catch the 400 and retry once with `parse_mode: undefined`. Lose formatting, keep delivery.
6. **`refreshAllUserSkills` worker.** Today it iterates all rows and calls `handler.install.refreshConfig`. Telegram has no refresh — solution: only call `refreshConfig` if the install variant has it (i.e., if `install.type === "oauth2"`). Already true by typecheck since `refreshConfig` is on oauth2 only — confirm at the `refreshAndPersist` call site filters by install.type. (`packages/backend/src/skills/refresh.ts` — re-check during implementation.)
7. **MQTT / realtime delivery on web-UI when reply comes from Telegram.** When the agent writes the assistant text row, `publishRealtimeEvent` fires (already wired in `insertPart`). The web user (if they have the chat open) sees the assistant reply land in real time — they just can't reply unless we open the channel-skill chat to web replies too (yes, we should; it's free and harmless).
8. **Rate limits.** Telegram caps outbound to 30 msgs/sec per bot. Demo scale won't hit this. Log and ignore for now.

---

## Acceptance

1. Settings → Skills shows a "Telegram" card. Click "Connect" → modal → paste bot token → success toast, card flips to "Connected — @<bot_username>".
2. User messages the bot on Telegram with `"hi"` → a new chat appears in the sidebar of the web app, first message `"hi"`, assistant generates a reply, the reply lands in the Telegram chat within a few seconds. The web user can reply in the same chat and the agent's response mirrors back to Telegram — no distinction in either direction.
3. Replying again on Telegram appends to the same chat session.
4. Sending an image on Telegram → web app shows `"[image] - not supported yet"` as the user message, agent replies appropriately, reply hits Telegram.
5. Settings → "Disconnect" → row deleted, future Telegram messages return 404 from the webhook (no row), bot stops mirroring.
6. The agent's sandbox sees `memory`, `webSearch`, and `googleCalendar1` (if installed), but NEVER `telegram1`. Verified by reading the system prompt at runtime: no telegram declaration appears in the `declarations.join("\n\n")` block.
7. `./packages/backend/scripts/e2e_telegram.ts` passes — exit code 0, asserts cover install, secret-header verification, text inbound, photo placeholder, dispatch outbound, and uninstall.
