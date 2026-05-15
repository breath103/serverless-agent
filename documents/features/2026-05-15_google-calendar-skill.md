# Google Calendar Skill — Design

**Status:** proposed
**Issue:** [#1 — Add Google Calendar skill](https://github.com/breath103/serverless-agent/issues/1)
**Date:** 2026-05-15
**Reference:** Pensieve-1 (`/Users/kurtlee/Work/Pensieve-1`) implements the same pattern; this doc captures the port + adaptations.

---

## Problem

The agent has only built-in, no-config skills (`memory`, `web-search`). The `defineSkill` abstraction already has an `install` slot, but nothing exercises it. Adding Google Calendar:

1. Validates the OAuth2 installation path end-to-end (any future provider — Slack, Notion, Linear — slots in by mirroring this skill).
2. Lets the demo show real, user-specific data in chat ("what's on my calendar this week?").
3. Forces the persistence layer for per-user skill config — needed for any non-builtin skill, ever.

## Approach — port Pensieve's pattern, adapt for our stack

Pensieve already implements Google Calendar (plus Mail/Drive/Sheets) on Postgres + better-auth. **Do not redesign.** Port file-for-file; rewrite only the DB layer and the `edgeUrl` helper. Limit scope to `google-calendar` for now — the same `defineGoogleSkill` helper handles the other three skills as one-liners later.

### Things Pensieve does that we keep verbatim

- `defineGoogleSkill({ id, displayName, description, scopes })` returning a `defineSkill(...)` with `install: { type: "oauth2", getInstallUrl, completeInstall, uninstall, refreshConfig }`.
- OAuth2 helpers (`exchangeOAuth2Code`, `refreshOAuth2Token`, `buildOAuth2AuthUrl`, `fetchGoogleUserInfo`) inline in `skills/google.ts`. Zod-validated provider responses (no `as` casts).
- Auth URL params: `access_type=offline`, `prompt=consent`, `state=base64url(JSON({ skillId, userId }))`. **Keep `prompt=consent`** — Google only returns a `refresh_token` on first consent unless the user is forced to re-consent.
- The 5 calendar methods on the runtime: `listCalendars`, `listEvents`, `createEvent`, `updateEvent`, `deleteEvent`. Same signatures.
- Routes: `POST /api/skills/install/oauth/redirect` (start), `GET /api/skills/oauth/callback` (finish), `GET /api/skills/installed` (list), `DELETE /api/skills/:id` (revoke).
- Routes layer reuses `c.get("requireUser")` from existing auth.
- `edgeUrl(c, path)` 4-line helper on `app-context.ts` (reads `x-forwarded-host` / `x-forwarded-proto`, falls back to `host`).

### Things we rewrite

| Concern | Pensieve | This repo |
|---|---|---|
| **DB layer** | Kysely `selectFrom("user_skills")` | DocumentClient `Query` / `PutCommand` against `tables.userSkills()` |
| **PK shape** | UUID `id` PK + `user_id` FK | `(user_id HASH, id RANGE)` — same as every other table here |
| **Lodash** | `chain(rows).groupBy(...).toPairs()` | Plain `Object.entries` (we dropped lodash-es from backend deps in the earlier ontology removal) |
| **`AnthropicProvider` / `S3AgentFileStorage` runtime options** | Wired in `buildSkills` for the `llm` / `audio` skills | Not needed — `googleCalendar.create` takes `undefined` for opts, same as Pensieve. `buildSkills`' `runtimeOptions` stays as `{ userId }` |

### Things we improve over Pensieve

**Token refresh on agent load.** Pensieve defines `refreshConfig` on every Google skill but never calls it — tokens just expire after ~1h and the next API call 401s. Our `buildSkills` will:

1. `userSkillsRepo.listForUser(userId)` (as Pensieve does).
2. For each row, call `handler.install.refreshConfig(row.data.config)`.
3. If returned config differs from input (i.e., `accessToken` changed), `userSkillsRepo.updateData(row.id, { skill_id, config: refreshed })` to persist.
4. Use the refreshed config in `loadSkill(...)`.

This is one extra `if`-comparison per row per chat turn — negligible cost, and means tokens never expire mid-turn.

### Things we explicitly defer

- Gmail, Drive, Sheets — same `defineGoogleSkill` machinery; one-line additions in `skills/google.ts` once Calendar works.
- Slack, Telegram — `install.type === "auth"` flavour, more code (verification ping, bot tokens). Not in this issue.
- Cron-based proactive refresh — Pensieve has one (`lib/cron-tick.ts`); we don't. The refresh-on-load above is sufficient until the demo grows scheduled jobs.
- Multiple Google accounts per user. (Pensieve allows it via duplicate rows; we'll **dedupe on `(user_id, skill_id)` in the OAuth callback** — easier to reason about, smaller surface, can lift later.)
- CSRF nonce in OAuth state. Pensieve doesn't have one either; the state is JSON of `{ skillId, userId }`. Acceptable for an authenticated-user flow but flag with a TODO.

---

## Persistence — `user-skills` DynamoDB table

```
TableName: ${TABLE_NAME_PREFIX}-user-skills
PartitionKey: user_id  (S)
SortKey:      id       (S)   -- UUID
```

Row shape (`UserSkillRow`):

```ts
{
  user_id: string;
  id: string;                          // uuid
  data: { skill_id: "google-calendar"; config: GoogleSkillConfig };
  created_at: string;                  // ISO
  updated_at: string;                  // ISO
}
```

Repo methods (`UserSkillsRepository`):

- `listForUser(userId)` — `Query` by user_id.
- `getByIdForUser(userId, id)` — `GetItem` with the composite key.
- `findByUserAndSkill(userId, skillId)` — `Query` + filter on `data.skill_id` (n is tiny per user; no GSI needed).
- `upsert({ userId, skillId, config })` — find existing by `(userId, skillId)`; if present `UpdateItem`, else `PutItem` with new UUID. Returns the persisted row.
- `updateData(userId, id, config)` — `UpdateItem` setting `data.config` + `updated_at`. Used by the token refresh path.
- `deleteForUser(userId, id)` — `DeleteItem`.

`PublishRealtimeEvent` on every upsert/delete so the frontend `RepositoryContext` reflects connect/disconnect instantly.

No GSI for MVP. Pensieve has a `listBySkillId` method used by its cron; we don't.

---

## OAuth flow — sequence diagram

```
1. User clicks "Connect Google Calendar" in /dashboard/settings/skills
   └─> POST /api/skills/install/oauth/redirect { skillId: "google-calendar" }
        └─> backend returns { redirectUrl: "https://accounts.google.com/o/oauth2/v2/auth?..." }
             - state = base64url(JSON({ skillId, userId: c.requireUser().id }))
             - redirect_uri = edgeUrl(c, "/api/skills/oauth/callback")
2. Browser navigates to redirectUrl; user consents.
3. Google redirects back: GET /api/skills/oauth/callback?code=...&state=...
   └─> backend
        - decodes state → { skillId, userId }
        - exchangeOAuth2Code() → { accessToken, refreshToken, expiresAt }
        - fetchGoogleUserInfo(accessToken) → { email, name }
        - userSkillsRepo.upsert({ userId, skillId, config: { accessToken, refreshToken, expiresAt, email, name } })
        - publishRealtimeEvent(userId, { table: "user_skills", op: "upsert", row })
        - 302 to edgeUrl(c, "/dashboard/settings/skills?connected=google-calendar")
4. Frontend SkillsPage sees ?connected=… in URL, refetches /api/skills/installed (or RepositoryContext picks up the realtime event).
```

Failure paths: if `code` is missing or `error` is present in callback query → redirect to `/skills/oauth/callback-error?skill=...&error=...` (frontend renders a simple error screen).

---

## Files

### Add

| File | Lines (est.) | Notes |
|---|---|---|
| `packages/backend/src/skills/google.ts` | ~180 | Port from Pensieve verbatim; export only `googleCalendar` |
| `packages/backend/src/skills/user-skills-repository.ts` | ~120 | DDB rewrite of Pensieve's Kysely repo |
| `packages/backend/src/lambda-api/routes/skill.ts` | ~130 | Port from Pensieve; drop `auth`-type branches |
| `packages/backend/src/agent-runtime/skill-runtimes/google-calendar.ts` | ~170 | Port verbatim |
| `packages/backend/src/agent-runtime/declarations/skills/google-calendar.generated.d.ts` | auto | `generate-declarations.ts` emits this |
| `packages/frontend/src/routes/app/dashboard/settings/skills/_route.tsx` | ~20 | TanStack route shell |
| `packages/frontend/src/routes/app/dashboard/settings/skills/SkillsPage.tsx` | ~150 | List + Connect/Disconnect buttons, realtime-driven |
| `packages/frontend/src/routes/app/dashboard/settings/skills/skills.ts` | ~25 | Display catalog: one entry for google-calendar |

### Modify

- `packages/backend/src/skills/index.ts` — register `googleCalendar`; add `SkillConfig` tagged union, `Oauth2InstallSkillMap`, `oauth2SkillHandlers`.
- `packages/backend/src/agent-runtime/skill-runtimes/index.ts` — add `loadSkill(...)` dispatcher.
- `packages/backend/src/agent-runtime/skills.ts` — extend `buildSkills` to read `user_skills`, refresh-on-load, instantiate via `loadSkill`, emit per-instance declarations.
- `packages/backend/src/agent-runtime/types.ts` — `SkillCall` gains `CallsOf<"google-calendar", typeof googleCalendar>`.
- `packages/backend/src/lambda-api/routes/index.ts` — register `skillRoutes`.
- `packages/backend/src/lib/app-context.ts` — add `edgeUrl(c, path)`.
- `packages/backend/src/lib/ddb.ts` — `tables.userSkills`.
- `packages/backend/src/lib/realtime-events.ts` — `user_skills: UserSkillRow` in `RealtimeTableRowMap`.
- `packages/backend/src/types/database.ts` — `UserSkillRow`.
- `packages/backend/src/env.d.ts` — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- `packages/backend/.env.sample` — same.
- `packages/backend/scripts/lib/backend-stack.ts` — new `${id}-user-skills` table.
- `packages/backend/scripts/ddb-local.ts` — same spec for local DDB.
- `packages/frontend/src/routes/app/Sidebar.tsx` — "SKILLS" link in `SETTINGS_ITEMS`.
- `packages/frontend/src/routes/app/dashboard/chats/MessageBlock.tsx` — `case "google-calendar":` for skill-call display rows.
- `packages/frontend/src/contexts/RepositoryContext.tsx` — `user_skills` entity config.
- `packages/frontend/src/routeTree.gen.ts` — add `skillsRoute`.

### Run

- `./packages/backend/scripts/generate-declarations.ts` (after `google-calendar.ts` is in place — required for the agent's sandbox to see the new skill's types).
- `npm run -w backend ddb:reset` (after backend-stack/ddb-local changes — recreates local tables with `user-skills`).

---

## Risks / open questions

1. **Local OAuth redirect URI.** Google requires the redirect URI in the Cloud Console to match exactly. Dev: `http://localhost:<edgeDevPort>/api/skills/oauth/callback` (currently `6001`). User must configure this in their Google OAuth client before the connect flow works. Document in `documents/features/...` and link from PR body.
2. **`refresh_token` only on first consent.** `prompt=consent` mitigates this but it means every connect is a full consent screen (no silent re-auth). Acceptable for demo; flag for future.
3. **No CSRF token in OAuth state.** State is plain base64-JSON, no nonce. Acceptable because the callback also re-checks the session and writes the row under the user from `state.userId` — an attacker who hijacked the state would need an already-authenticated session for that user. Add a nonce in a follow-up if we ever expose the OAuth callback path more broadly.
4. **Token persistence ↔ realtime.** `publishRealtimeEvent` on every refresh would chatter MQTT. The refresh path should publish only when `expiresAt` actually changed (skip otherwise).
5. **DynamoDB write contention on token refresh.** If two chat turns start near-simultaneously and both refresh, we get two writes. Last-writer-wins is fine — both tokens are valid for the same window; this is at-most-one-redundant-fetch, never broken.

## Acceptance — same as the issue

1. `npm run -w backend ddb:reset && ./scripts/dev.ts start && /dashboard/settings/skills` → can connect via Google consent flow, see account email displayed.
2. New row in DDB `user-skills` table with `refresh_token` present.
3. Chat: "what's on my calendar this week?" → `googleCalendar1.listEvents(...)` skill call appears in chat UI.
4. After 5min-before-expiry, next chat turn auto-refreshes the token; persisted row updated.
5. Disconnect button revokes token at Google + deletes the DDB row + clears the frontend list.
