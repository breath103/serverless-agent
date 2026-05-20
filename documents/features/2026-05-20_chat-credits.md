# Chat Credits — Design

**Status:** proposed
**Issue:** [#17 — Credit system: 100 on signup, 1 deducted per user message, block at 0](https://github.com/breath103/serverless-agent/issues/17)
**Date:** 2026-05-20
**Depends on:** Issue #16 (already landed) — `users.credits: number` column exists and is set to 100 on user creation.

---

## Problem

Each user-authored chat message must atomically deduct 1 credit from `users.credits`. At 0 credits, the send is rejected with HTTP 402, the UI surfaces "You ran out of credit" inline above the composer, and the composer is disabled. Agent replies, tool calls, and worker-initiated work do **not** deduct credits — only the user pressing "send".

## Approach — decrement at the route boundary, not in `continueChatSession`

The route handler already owns HTTP semantics (`HTTPException(409)` for the busy-lock case, `requireOrThrow`). The credit check fits the same shape: atomic DDB conditional update at the route, returns null on failure, route translates to 402.

**Credit check fires BEFORE `beginGenerating` so there's no lock to release on failure.** This matches the explicit guidance in the issue's "Risks / open questions" — credit check before the lock is the preferred placement.

### Two user-initiated send paths share one credit check

`packages/backend/src/lambda-api/routes/chat-session.ts` has TWO routes that ingest a user message:

| Route | Calls | Credit cost |
|---|---|---|
| `POST /api/chat` | `startChatSession({ kind: "user", userMessageText })` | 1 |
| `POST /api/chat/:id/message` | `continueChatSession(...)` | 1 |

Both consume a credit. The `chat-session.ts:17–25` handler (`POST /api/chat`) only fires for `kind: "user"` sessions today — internal (worker-initiated) chats use a different path and don't go through this route, so the route boundary IS the user-vs-internal discriminator. No need to gate inside `startChatSession`.

### `usersRepo.decrementCredits(userId): Promise<UserRow | null>`

Mirrors the existing `beginGenerating` pattern: returns the updated row on success, `null` on failure (mirrors `updateIf` semantics). No new typed error class — Hono `HTTPException(402)` thrown at the route is the project's convention (matches every other 4xx path in this codebase). The deleted `UsernameTakenError` class from Issue #16 was the only repo-level typed-error in the codebase; we didn't replace it, and we won't add a new one here.

```ts
// users-repository.ts
async decrementCredits(id: string): Promise<UserRow | null> {
  return this.table.updateIf({
    key: { id },
    updateExpression: "SET credits = credits - :one, updated_at = :u",
    conditionExpression: "credits >= :one",
    expressionAttributeValues: { ":one": 1, ":u": new Date().toISOString() },
  });
}
```

`updateIf` returns `null` on `ConditionalCheckFailedException`, which is the "credits < 1" case. Same semantics as the existing lock-flip in `chat-sessions-repository.ts`.

### Route shape

```ts
const outOfCredit = () => new HTTPException(402, { message: "out_of_credit" });

route("/api/chat", "POST", {
  body: { message: z.string().min(1).max(MESSAGE_MAX) },
  handler: async ({ body, c }) => {
    const user = c.get("requireUser")();
    requireOrThrow(await usersRepo.decrementCredits(user.id), outOfCredit);
    return await startChatSession({ userId: user.id, kind: "user", userMessageText: body.message });
  },
}),

route("/api/chat/:id/message", "POST", {
  body: { message: z.string().min(1).max(MESSAGE_MAX) },
  handler: async ({ params, body, c }) => {
    const user = c.get("requireUser")();
    requireOrThrow(await usersRepo.decrementCredits(user.id), outOfCredit);
    const session = requireOrThrow(await beginGenerating(params.id, user.id), chatBusy);
    await continueChatSession({ userId: user.id, sessionId: session.id, userMessageText: body.message });
    return { ok: true as const };
  },
}),
```

Decrement fires first, so `beginGenerating` only runs if credit was successfully deducted. If `beginGenerating` later 409s (chat busy), the credit is **lost** — that's a minor footgun but matches "every send costs a credit even if the chat was momentarily locked by an in-flight reply." Acceptable for the demo; flag for refinement if it bites.

### Why not refund on `beginGenerating` failure?

Two reasons to NOT add a refund path:
1. The 409 case is rare (requires racing against an in-flight reply for the same chat session).
2. Adding compensation logic (`SET credits = credits + 1`) introduces non-atomic state — the user sees `97 → 96` even though their send was rejected. With refund, the user sees `97 → 96 → 97` which is more confusing than `97 → 96` plus a 409 error.

Flag as a follow-up if it becomes a real UX issue.

---

## Frontend

### Out-of-credit UX

On 402 response, the chat composer flips to an "out of credit" state:

1. A non-dismissable banner appears **between the message list and the composer**: `"You ran out of credit. New messages are paused."`
2. The composer textarea and send button are **disabled**.
3. The state is **ephemeral** — held in React local state on the chat view, scoped to the page session. A page reload clears the banner. The composer stays disabled across reloads only after Issue #18 lands (which adds `credits` to `AuthUser`); for #17 alone, reloading "resets" the visible state but the next send attempt still 402s.

The failed user message is **not** rendered in the message stream — the spec explicitly says "do NOT insert the message." Inventing a client-side message that doesn't exist in DDB and rendering it in the stream is more confusing than treating the banner as the single visible artifact of the failed send.

### Wiring

- `ChatConversation.tsx` (or wherever the send mutation lives) catches the 402 in the send `useMutation` error handler. Parses the response body for `{ message: "out_of_credit" }`, sets `outOfCredit: true` on local state.
- `ChatInput.tsx` already has a `disabled` prop (used for the "busy generating" case). Pass `disabled = busy || outOfCredit`.
- New `<OutOfCreditBanner />` component rendered above the composer when `outOfCredit` is true. Plain styled div, project design tokens, no animation (it's a sticky state, not a transient).

---

## Files

### Add

| File | Notes |
|---|---|
| `packages/backend/scripts/e2e_credits.ts` | e2e harness — exhaust credits via repo, verify 402 responses, verify concurrent-send race safety. |
| `packages/frontend/src/routes/app/dashboard/chats/OutOfCreditBanner.tsx` | One-component file. Decision: inline into ChatConversation if it ends up <10 lines. |

### Modify

- `packages/backend/src/users/users-repository.ts` — add `decrementCredits(id)` using `updateIf`. ~12 lines.
- `packages/backend/src/lambda-api/routes/chat-session.ts` — add `outOfCredit` factory, two new `requireOrThrow` calls (one per user-message route). ~5 lines.
- `packages/frontend/src/routes/app/dashboard/chats/ChatConversation.tsx` (or equivalent) — error-handle 402 in send mutation, expose `outOfCredit` state to the input + banner. ~10–15 lines.
- `packages/frontend/src/routes/app/dashboard/chats/ChatInput.tsx` — already takes `disabled`; no API change. Just pass `outOfCredit` in from the parent.

### No changes

- `agent-runtime/start-chat-session.ts` — `continueChatSession` and `startChatSession` stay pure. The credit gate is route-layer, mirroring `beginGenerating`.
- `chat-sessions-repository.ts` — no schema change.
- `chat_session_messages` schema — no schema change. We do NOT insert an "out of credit" assistant error message into DDB.

---

## E2E plan — `packages/backend/scripts/e2e_credits.ts`

Direct repo-level tests (no HTTP — exercise the decrement primitive's atomicity):

1. **Seed**: write a user row with `credits: 2` via `ddbTables.users.put`. (Skip `usersRepo.create` because that hardcodes 100.)
2. **Sequential drain**:
   - `decrementCredits(userId)` → returns row with `credits: 1`. ✓
   - `decrementCredits(userId)` → returns row with `credits: 0`. ✓
   - `decrementCredits(userId)` → returns `null` (condition `credits >= 1` fails). ✓
3. **Race safety**: seed `credits: 1`, then `Promise.all([decrementCredits, decrementCredits])` → exactly one returns the row, the other returns `null`. Final `credits: 0`. ✓
4. **HTTP-layer verification**: with `devSignIn(DEV_ADMIN_USER_ID)`, `POST /api/chat` with credits exhausted → 402 response with `{ error: "out_of_credit" }`. Confirms the route translation works end-to-end.

Frontend smoke (manual, in PR demo):
- `./scripts/dev.ts start`, log in via Google (or set sa_session via devSignIn), navigate to chat, send messages until 402, screenshot the banner + disabled composer.

---

## Risks / open questions

1. **Credit consumed on 409 `chat busy`.** Covered above — accepted, no refund path. Flag for follow-up.
2. **No live counter on this PR.** The user sees their credits drop only when they hit the wall. Issue #18 adds the running counter.
3. **Multi-tab race.** Two browser tabs of the same user can both fire `POST /api/chat/:id/message` concurrently. The DDB conditional update guarantees at most one succeeds when credits would go negative; the other gets 402. Same race-safety as the e2e harness verifies. ✓

## Acceptance

- A user with `credits: 3` sends 3 messages → all succeed, `credits: 0`.
- 4th send returns 402 with `{ error: "out_of_credit" }`.
- Frontend renders the inline "You ran out of credit" banner above the composer and disables the textarea + send button.
- Race: two concurrent sends from the same user at `credits: 1` — exactly one succeeds, the other 402s. DDB `credits` ends at 0, never negative.
- `e2e_credits.ts` exits 0 against a clean local DDB.
