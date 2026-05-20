# Google-Only Auth — Design

**Status:** proposed
**Issue:** [#16 — Auth overhaul: Google sign-in only](https://github.com/breath103/serverless-agent/issues/16)
**Date:** 2026-05-20
**Prior art used:** [`2026-05-15_google-calendar-skill.md`](./2026-05-15_google-calendar-skill.md) — the OAuth2 primitives (`buildOAuth2AuthUrl`, `exchangeOAuth2Code`, `fetchGoogleUserInfo`) already exist in `packages/backend/src/skills/google.ts`. We extract them; we do not rewrite them.

---

## Problem

Today the app authenticates users with username + scrypt-hashed password (`packages/backend/src/auth/index.ts`, `EmailPasswordForm.tsx`). We are switching to **Google sign-in as the only allowed auth method**. Username/password sign-up and sign-in are removed entirely. Every new user is granted **100 credits** at first sign-in (the `credits` field consumed by Issue #17 / #18 is added here as part of the same schema move).

`CLAUDE.md`'s "No third-party OAuth integrations" and "no billable-usage tracking" demo constraints are dropped in this PR.

---

## Approach — reuse the skill OAuth machinery, split user identity from provider identity

The existing skill flow already does Authorization Code + access/refresh tokens against Google. The only differences for user SSO are:

| Concern | Skill flow (today) | User SSO flow (this issue) |
|---|---|---|
| Caller's session at start | Authenticated user clicking "Connect" | Anonymous browser hitting `/login` |
| What `state` binds to | `{ skillId, userId }` from `c.requireUser()` | A random nonce in a short-lived cookie — there is no user yet, so the cookie is the CSRF anchor |
| What the callback persists | `user_skills` row with tokens | `users` row (or finds existing) + `accounts` row + new session + `sa_session` cookie |
| Tokens we keep | `accessToken` + `refreshToken` (long-lived API access) | Discarded after first userinfo fetch — we only need the identity, not API access |

Because we discard the tokens, **no refresh logic** is needed in this path — the user re-signs-in with Google if their `sa_session` cookie expires (30-day TTL today, unchanged).

### Extract OAuth helpers to `lib/google-oauth.ts`

The four functions in `skills/google.ts` (`buildOAuth2AuthUrl`, `exchangeOAuth2Code`, `refreshOAuth2Token`, `fetchGoogleUserInfo`) plus the zod schemas move to `packages/backend/src/lib/google-oauth.ts`. `skills/google.ts` re-imports them. No behavior change; we just stop hiding them inside the skills package because `auth/` now needs them too. (Per `/refactor-loop` rule: helpers duplicating project utilities → reshape. Better to do it now than have two copies.)

### Things we explicitly do NOT do

- **No keep-the-username-flow-around toggle.** Every username/password file gets deleted, not gated.
- **No data migration.** The DB is empty in dev and only holds test users elsewhere. `npm run -w backend ddb:reset` recreates with the new schema. If existing users exist on a deployed env they sign in fresh.
- **No multi-provider routing logic in routes.** Google is the only provider for now. The `accounts` table is provider-shaped (carries a `provider` column) so adding Apple/GitHub later means adding rows + a new route, not reshaping the user row.
- **No refresh token storage anywhere.** Identity-only flow.

---

## Schema — `users` unchanged structure, new `accounts` table

User identity stays where it is: `users.id` is a uuid, the PK, and the FK target for every other table. The auth overhaul does **not** reshape it. All provider-specific identity (Google `sub`, the email Google gave us, `email_verified`) moves to a new `accounts` table joined by `user_id`.

This means:
- No churn to `sessions.user_id`, `profiles.user_id`, `chat_sessions.user_id`, `memories.user_id`, `user_skills.user_id` — same uuid values, same column shapes.
- No `email_already_registered` collision case — users are keyed by uuid, not email. Two Google accounts with the same email (e.g. work + personal of the same human) create two distinct users; one Google account's email being reissued post-deletion gives the new owner a fresh user (new `sub`, new account row, new user uuid). Both are intuitively correct.

```ts
// types/database.ts
export type UserRow = {
  id: string;           // uuid — UNCHANGED PK
  name: string;         // from Google userinfo (initial value; user can edit via profile)
  credits: number;      // default 100, granted at user creation, never re-granted
  created_at: string;
  updated_at: string;
};

export type AccountRow = {
  user_id: string;            // FK to users.id (uuid)
  provider: "google";         // closed enum; adding "apple"/"github" later widens this literal union
  sub: string;                // provider's stable user id
  email: string;              // from Google userinfo — display only, not unique across users
  email_verified: boolean;
  created_at: string;
  updated_at: string;
};
```

**Deleted from UserRow:** `username`, `password_hash`. **Kept:** everything else.

### DDB tables

```
users:
  PartitionKey: id (S)         # unchanged from today
  (GSI by-username removed.)

accounts:                       # new table
  PartitionKey: user_id (S)
  SortKey:      provider (S)    # one row per (user, provider); supports future Apple/etc. without reshape
  GSI by-provider-sub:
    PartitionKey: provider (S)
    SortKey:      sub (S)
    Projection:   ALL           # callback needs user_id + email back
```

Hot read on sign-in: "given (google, sub), find the user" → GSI Query → AccountRow → `usersRepo.getById(user_id)`.
Cold read on settings: "list this user's linked accounts" → base-table Query by `user_id`.

CDK changes in `packages/backend/scripts/lib/backend-stack.ts` and the local-dev mirror in `packages/backend/scripts/ddb-local.ts`.

### `AuthUser` shape

Currently `Pick<UserRow, "id" | "username" | "name">` — drops `username`, picks up `email` (joined from the user's `accounts` row(s) at `resolveSession` time so the rest of the app doesn't have to fetch separately):

```ts
export type AuthUser = {
  id: string;       // uuid (unchanged)
  name: string;
  email: string;    // joined from accounts row; for the demo there's always exactly one account per user
};
```

For the demo with only Google, every user has exactly one accounts row, so picking "the email" is unambiguous. If we add a second provider later, this becomes "the most recently used account's email" or "primary account" — flag for later.

Every consumer that reads `user.username` switches to `user.email`. `user.id` reads stay untouched (still a uuid).

### `credits` default of `100`

Set in application code at `usersRepo.create(...)`, not in DDB. Matches the `application-level defaults` rule in `backend.md`. Granted once at user creation; repeat sign-ins find the user via the accounts table and never re-grant.

---

## Routes

### `GET /api/auth/google/start`

1. Generate `state = randomBytes(32).toString("hex")`.
2. `setCookie(c, "sa_oauth_state", state, { path: "/", maxAge: 600, httpOnly: true, sameSite: "Lax", secure: isRequestSecure(c) })` — 10-minute lifetime.
3. Build the Google auth URL via `buildOAuth2AuthUrl({ ...googleConfig, scopes: ["openid", "email", "profile"] }, edgeUrl(c, "/api/auth/google/callback"), state)`.
4. `c.redirect(authUrl, 302)`.

Returns a redirect, not JSON — the frontend just does `window.location.href = "/api/auth/google/start"`. Avoids a CORS round-trip and means the auth flow is plain HTML navigation, which is easier to reason about.

### `GET /api/auth/google/callback?code&state`

1. Validate `code` and `state` present in query (HTTPException 400 otherwise).
2. Read `sa_oauth_state` cookie; if missing or `!= state`, throw HTTPException 400 (`invalid_state`).
3. Delete the state cookie (one-shot).
4. `exchangeOAuth2Code({ ...googleConfig }, code, edgeUrl(c, "/api/auth/google/callback"))` → `{ accessToken, refreshToken, expiresAt }`. We discard `refreshToken` and `expiresAt`.
5. `fetchGoogleUserInfo(accessToken)` — extend the existing helper to return `{ sub, email, email_verified, name }` (currently returns `{ email, name }`). Same Google endpoint, more fields.
6. `signInWithGoogle({ sub, email, emailVerified, name })` — see "Sign-in flow" below.
7. Create a new session, set `sa_session` cookie.
8. `c.redirect(edgeUrl(c, "/app"), 302)` — frontend `AuthContext` refetches `/api/auth/session` on mount and sees the user.

Error paths (Google returned `?error=...`, code exchange failed, state mismatch): respond with HTTPException carrying a `message` — the existing edge error handler renders an error page. We do NOT redirect to a custom error route for the demo.

### `signInWithGoogle({ sub, email, emailVerified, name })` — find-or-create flow

```
1. account = accountsRepo.findByProviderSub({ provider: "google", sub })
2. If account exists:
     user = usersRepo.getById(account.user_id)               // must exist; if not, data corruption → 500
     return user
3. Else (this sub has never signed in):
     user = usersRepo.create({ name, credits: 100 })          // generates uuid
     profilesRepo.create(user.id, { name })                   // bootstrap, same as old signUp
     accountsRepo.create({ userId: user.id, provider: "google", sub, email, emailVerified })
     return user
```

No email uniqueness check, no collision error. Users are keyed by uuid; emails on `accounts` are display-only.

### Removed routes

- `POST /api/auth/sign-up`
- `POST /api/auth/sign-in`

Kept unchanged: `POST /api/auth/sign-out`, `GET /api/auth/session`, auth middleware, `sa_session` cookie, `SessionsRepository`, `resolveSession`.

---

## Files

### Add

| File | Notes |
|---|---|
| `packages/backend/src/lib/google-oauth.ts` | Move the 4 OAuth helpers + zod schemas out of `skills/google.ts`. Extend `fetchGoogleUserInfo` to return `{ sub, email, email_verified, name }`. |
| `packages/backend/src/auth/google-oauth-routes.ts` | The `/start` + `/callback` handlers. Lives next to existing auth code. |
| `packages/backend/src/accounts/accounts-repository.ts` | New repo, new table. Methods: `findByProviderSub({provider, sub})`, `create({userId, provider, sub, email, emailVerified})`, `listForUser(userId)`. |

### Modify

- `packages/backend/src/auth/index.ts` — delete `signUp`, `signIn`, `UsernameTakenError`; add `signInWithGoogle`. Update `AuthUser` shape: drops `username`, adds `email` (joined from accounts in `resolveSession`).
- `packages/backend/src/auth/password.ts` — **delete**.
- `packages/backend/src/users/users-repository.ts` — drop `getByUsername`; rewrite `create` for the new shape (`{ name, credits: 100 }`, generates uuid as today). PK stays `id`.
- `packages/backend/src/types/database.ts` — `UserRow` drops `username` + `password_hash`, gains `credits`. Add new `AccountRow`.
- `packages/backend/src/lib/ddb.ts` — `tables.accounts(...)` definition matching the new table.
- `packages/backend/src/lambda-api/hono.ts` — delete sign-up + sign-in routes; wire `/api/auth/google/start` + `/callback`. Auth middleware unchanged.
- `packages/backend/src/skills/google.ts` — re-export helpers from `lib/google-oauth.ts`; no behavior change.
- `packages/backend/scripts/lib/backend-stack.ts` — drop `by-username` GSI on `users`. Add new `accounts` table.
- `packages/backend/scripts/ddb-local.ts` — same.
- `packages/backend/src/env.d.ts` — already has `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; verify.
- `packages/backend/.env.sample` — verify those keys are documented.
- `packages/backend/__tests__/**` — tests for `signUp`/`signIn`/`password.ts` deleted (not "skipped"). Add tests for the new sign-in flow's branches.
- `packages/frontend/src/routes/login/_route.tsx` — strip the mode toggle, render `<GoogleSignInButton/>` only.
- `packages/frontend/src/routes/login/EmailPasswordForm.tsx` — **delete**.
- `packages/frontend/src/routes/login/GoogleSignInButton.tsx` — **add**. One button, `onClick = () => { window.location.href = "/api/auth/google/start" }`.
- `packages/frontend/src/lib/auth-client.ts` — delete `signIn.username` / `signUp.username` methods. Type return of `getSession()` to the new `AuthUser`.
- `packages/frontend/src/contexts/AuthContext.tsx` — propagates the new `AuthUser` shape (no more `username`; `email` available).
- Frontend consumers reading `user.username` — switch to `user.email`. Typecheck drives this.
- `CLAUDE.md` — drop the two demo constraints; add a line stating Google OAuth is the only auth path and credits exist.
- `.claude/rules/dev.md` — if it documents the username sign-up curl anywhere, remove.

---

## Local OAuth setup (one-time per developer)

1. Google Cloud Console → APIs & Services → Credentials → create OAuth 2.0 Client ID (Web application).
2. Authorized redirect URI: `http://localhost:6001/api/auth/google/callback`.
3. Copy `Client ID` and `Client secret` into `packages/backend/.env.development`:
   ```
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   ```
4. The same client also serves the existing google-calendar skill flow — they share the env vars.

Document in PR body.

---

## E2E plan

1. `npm run -w backend ddb:reset` to wipe the table with the new schema.
2. `./scripts/dev.ts start`.
3. Open `http://localhost:6001/login` in headless Chrome via `./scripts/e2e.ts`.
4. Click "Continue with Google" → navigate through Google's consent screen (test user account).
5. Land on `/app`, `GET /api/auth/session` returns `{ id, name, email }`.
6. DDB `users` table inspection: new row, `credits: 100`, no `username`/`password_hash`. `accounts` table: new row with `provider: "google"`, `sub: "..."`, `email: "..."`.
7. Sign out → sign in again → same `accounts` row hit by GSI, same `users` row loaded, credits still 100 (not re-granted).

Headless Google consent is fiddly — fallback is screen-recording the real browser flow via `./scripts/e2e.ts screenshot` at each step and stitching with ffmpeg.

---

## Risks / open questions

1. **Headless OAuth flow.** Google may block headless browsers from completing consent. If `./scripts/e2e.ts` can't drive it, e2e becomes "manual real-browser run with screenshots in PR body". Acceptable — the OAuth handshake itself is provider-tested.
2. **CSRF state cookie on cross-site redirect.** `SameSite=Lax` is fine: the callback is a top-level navigation initiated by Google, which Lax allows. (`Strict` would drop the cookie.)
3. **`fetch` from Lambda to `https://oauth2.googleapis.com` and `https://www.googleapis.com`.** Already working for the calendar skill — same network shape.
4. **Edge → backend cookie forwarding.** The edge proxy already forwards `sa_session`; same machinery handles `sa_oauth_state`.
5. **`credits` field added here, consumed by Issue #17/#18.** No race — Issue #17 lands after this, finds the field already present, and starts decrementing.
6. **Email duplication across users.** Two different Google accounts with the same email create two `users` rows. For the demo this is fine; if it ever needs deduping, that's a separate "merge accounts" feature.

---

## Acceptance

- Only sign-in path is the Google button on `/login`. No username/password UI anywhere.
- Fresh sign-in creates a `users` row with a new uuid + `credits: 100`, an `accounts` row with `provider: "google"` + `sub` + `email`, and a `profiles` row.
- Repeat sign-in with the same `(provider, sub)` lands on the same user, credits unchanged.
- `sa_session` cookie set and respected by every other authenticated route exactly as today.
- All tests + lint + types pass; old username-based tests deleted, not skipped.
