# Serverless Agent

An open-source demo showing that a full agent application — chat UI, tool-using LLM runtime, memory store, realtime browser updates — can run **entirely on AWS serverless primitives**. No managed Postgres, no custom domain, no third-party auth SaaS.

A clean, minimal demo. Most of the plumbing compiles and both CI jobs are green locally — **but nothing has been deployed to AWS yet**, so the end-to-end path has not been exercised. See "State of play" below.

---

## Architecture

```
Browser
  │
  ▼
CloudFront (default *.cloudfront.net host)
  │    ├─ S3  ← static React SPA
  │    └─ Lambda@Edge (origin-request)
  │         │
  │         └─ /api/* → Backend Function URL (looked up in SSM)
  │                      │
  │                      ▼
  │                   Hono on Lambda
  │                      │
  │    ┌─────────────────┼──────────────────┐
  │    ▼                 ▼                  ▼
  │  DynamoDB      S3 (agent files)   AWS IoT Core (MQTT)
  │  (6 tables)                        │
  └──── realtime row updates ◄─────────┘
```

- **Edge** — single CloudFront distribution, default `*.cloudfront.net` cert. Lambda@Edge at origin-request reads the backend URL from SSM and rewrites `/api/*` traffic to it. Everything else is served from S3 (SPA index.html fallback for unknown paths).
- **Backend** — Node.js 24 Lambda running Hono (`packages/backend/src/lambda-api/`).
- **Agent runtime** — in `packages/backend/src/agent-runtime/`. One tool (`executeCode`) that runs TypeScript in a sandbox with typed skill bindings: `memory`, `webSearch`, `audio`, `url`, `llm`. Skill calls are traced via a Proxy for UI rendering.
- **Storage** — every entity is its own DynamoDB table declared in the CDK stack (`packages/backend/scripts/lib/backend-stack.ts`). Pay-per-request. Attribute naming is snake_case to match the TS row shapes in `packages/backend/src/types/database.ts`.
- **Auth** — username + password; scrypt hashing; HTTP-only session cookie (`sa_session`); sessions table with DynamoDB TTL. See `packages/backend/src/auth/`.

---

## Repo layout

```
packages/
  backend/
    scripts/lib/backend-stack.ts     ← CDK: Lambda, S3, DynamoDB tables
    src/
      auth/                          ← scrypt + cookie sessions (replaces better-auth)
      users/                         ← users-repository on DynamoDB
      profiles/                      ← profiles-repository on DynamoDB
      memories/                      ← memories-repository on DynamoDB
      chat-sessions/                 ← chat sessions + messages on DynamoDB
      agent-runtime/                 ← LLM loop, sandbox, skill runtime
        skill-runtimes/              ← the six live skills
      lambda-api/                    ← Hono routes
      lib/
        ddb.ts                       ← DocumentClient singleton + table-name env lookup
        realtime-events.ts           ← MQTT event shapes (shared with frontend)
      types/database.ts              ← plain TS row types (no Kysely)
  frontend/                          ← Vite + React + TanStack Router
  edge/
    scripts/lib/edge-stack.ts        ← CDK: CloudFront + Lambda@Edge + S3
    src/origin-request/              ← routes /api/* → backend URL
  shared/                            ← config loader, SSM naming
scripts/
  dev.ts                             ← start/stop dev servers
  setup.ts                           ← interactive tss.json bootstrapper
```

---

## State of play

### Done (committed, `main` @ `5cb1f32`)

- DNS / Route53 / ACM / custom-domain wiring **removed** from both edge and backend stacks.
- **Six DynamoDB tables** declared in `packages/backend/scripts/lib/backend-stack.ts` (users, sessions, profiles, memories, chat-sessions, chat-messages). Pay-per-request, point-in-time recovery on, sessions table has TTL on `expires_at_epoch`.
- **All repos rewritten** to use the AWS SDK v3 DocumentClient via `src/lib/ddb.ts`. Table names come from `TABLE_*` env vars injected by the CDK stack.
- **Auth replaced.** `POST /api/auth/sign-{in,up,out}` + `GET /api/auth/session`. Cookie: `sa_session`, HttpOnly, SameSite=Lax, Secure.
- **Frontend auth** rewritten: `packages/frontend/src/lib/auth-client.ts` is a thin fetch wrapper; `AuthContext` re-fetches session on mount. Login page has both sign-in and sign-up modes.
- **Cut features**: ontology, billable-usage, radar, Google/Slack/Telegram skills, user-skills OAuth, Supabase CLI scripts, seed-persona, SQL migrations, telegram webhook tunnel, landing-page marketing copy left as-is for now.
- `.env.*` files **deleted** (they contained live API keys for Anthropic, OpenAI, Google, Tavily, PostHog). Added `.env.sample` templates.
- CI workflow (`.github/workflows/deploy.yml`) reduced to a check-only job on `ubuntu-latest` — no deploy step, no Telegram notify.
- **Both CI jobs green locally**: `backend build-types + lint + test` and `frontend build-types + lint + test`.

### Not yet verified / not done

These all compile and the types line up, but nobody has actually run them against AWS yet:

- **CDK synth**. I haven't run `cdk synth` or `cdk deploy` for either stack. Regional / cross-region / Lambda@Edge quirks could surface at deploy time.
- **Real DynamoDB I/O.** The repo layer has never been exercised. BatchGet chunking (100-key cap) and the "scan all then sort/filter in memory" pattern in `memories` is fine for a demo but will need pagination tweaks for anything real.
- **Cross-region backend URL lookup.** The edge stack's SSM policy allows reading `/${project}/backend/*`, and origin-request caches the lookup for 60s. Not tested end-to-end.
- **Agent runtime** still calls Anthropic + Tavily + AWS IoT. None of these are tested with real keys on this branch. `AGENT_MQTT_*` env vars are still required for the handler to start.
- **Dev server** (`./scripts/dev.ts start`) has not been run on this repo since the rewrite. Likely broken without a stubbed `.env.development` for backend + frontend.
- **No DynamoDB Local fallback.** The repos hit real AWS. For local dev you'll either need AWS creds pointed at real tables, or wire in DynamoDB Local + a custom endpoint in `src/lib/ddb.ts`.
- **Frontend routes for deleted features.** I removed `/dashboard/radars`, `/dashboard/settings/usage`, `/dashboard/settings/skills` from the sidebar and route tree, but a few supporting components / helpers might still be in the tree unused. Run knip on the frontend if this matters.
- **No integration tests.** Existing unit tests are placeholders. `src/__tests__/agent.test.ts` is entirely TODO stubs from the old codebase.
- **`.claude/` skills + rules** still reference the previous Supabase flow in a couple places. Non-blocking; update as you go.
- **`TSS_README.md`, `opencode.json`** kept as-is from the template. Delete or update if irrelevant.
- **Tests have 2 lint warnings** (pre-existing): `memory-content-editor` tailwind class, `react-hook-form` `watch()` in `ProfilePageLoaded`. Not errors.

---

## Getting started

### Prerequisites

- Node 24 (see `.nvmrc`)
- AWS credentials (for DDB, IoT, S3, Lambda, CloudFront, SSM)
- API keys: Anthropic (required), Tavily (required for web-search), OpenAI (for audio)

### One-time project config

```bash
cp .env.sample .env
cp packages/backend/.env.sample packages/backend/.env.development
cp packages/frontend/.env.sample packages/frontend/.env.development
# Fill in keys in each
```

Edit `tss.json` → change `project` and `repo` to your values.

### Local development

All scripts are executable — no `npm run` needed.

```bash
npm install
./scripts/dev.ts start        # backend + frontend + edge proxy in the background
./scripts/dev.ts status       # current state + edge proxy URL
./scripts/dev.ts stop
```

Access the app only through the edge-proxy URL printed by `start`.

**Caveat**: the dev backend talks to real DynamoDB tables named by your `.env.development`'s `TABLE_*` vars. You'll want a separate `-dev` suffix on those, or swap in DynamoDB Local (see "Known TODOs" below).

### CI parity (run before committing)

```bash
./packages/backend/scripts/build-types.ts \
  && ./packages/backend/scripts/lint.ts \
  && npm test -w backend

./packages/backend/scripts/build-types.ts \
  && ./packages/frontend/scripts/build-types.ts \
  && ./packages/frontend/scripts/lint.ts \
  && npm test -w frontend
```

**Never run `tsc` or `npx tsc` directly** — always use the `build-types.ts` scripts. See `CLAUDE.md` for why.

### Deploying

```bash
./packages/edge/scripts/deploy.ts deploy              # CloudFront + Lambda@Edge + S3
./packages/backend/scripts/deploy.ts --env=production # backend Lambda + DDB tables + worker
./packages/frontend/scripts/deploy.ts --env=production
```

Deploy order matters the first time: edge creates the S3 bucket the frontend deploys into, and backend writes its Function URL into SSM where the edge Lambda@Edge reads from.

---

## Known TODOs (good first commits)

1. **Do a real CDK synth + deploy.** Expect to hit one or two permission / region issues (Lambda@Edge is locked to `us-east-1`; backend can be anywhere).
2. **Seed a first user.** There's no "create admin" path — just open the app and use the sign-up form.
3. **Delete stale `.claude/` skills** that reference Supabase flows, or port them to the new DynamoDB setup.
4. **Write at least one integration test** that spins up DynamoDB Local and exercises `usersRepo.create` → `signIn` → `signOut`. The unit tests in place today are TODO stubs from the old project.
5. **Consider swapping AWS IoT for a simpler realtime** (Server-Sent Events from Lambda, or polling) if you want the demo to be truly zero-extra-setup. IoT works but the cert + MQTT wiring is heavy for a demo.

---

## Useful pointers

- **Adding a new DynamoDB table** — declare it in `packages/backend/scripts/lib/backend-stack.ts`, add to `allTables` and `tableEnv`, add a name getter to `src/lib/ddb.ts`, add the row type to `src/types/database.ts`, write a repo next to the existing ones.
- **Adding a new route** — `src/lambda-api/routes/<name>.ts`, export `routes`, then spread into `src/lambda-api/routes/index.ts`. Use `c.get("requireUser")()` to enforce auth.
- **Adding a new skill** — `src/agent-runtime/skill-runtimes/<name>.ts` using `defineSkillRuntime`, register in `skill-runtimes/index.ts` and `skills/builtins.ts`, then **run `./packages/backend/scripts/generate-declarations.ts`** — the agent sees skills via the generated `.d.ts`, typecheck alone won't catch a stale declaration.
- **Frontend talks to backend types directly** via the `@backend/*` path alias. Cross-package type breakage only surfaces in the frontend typecheck — always run both.

---

## License

MIT (intent — add a `LICENSE` file when you're ready to make the repo public).
