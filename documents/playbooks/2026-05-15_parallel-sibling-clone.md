# Parallel Sibling Clone — Independent Dev Environment

## Summary

Run a second (third, Nth) checkout of this repo as a sibling directory (e.g. `../serverless-agent-2`) with its own dev servers, DynamoDB Local container, and MQTT namespace — fully independent of the primary checkout. The discriminator is `dev.worktree` in `tss.override.json`: every per-instance resource (DDB container name + port, dev ports, e2e Chrome status file, MQTT topic prefix) is derived from `${project}-${dev.worktree}`, so two clones with different values can run side-by-side without conflicts.

**Do NOT use `git worktree` for this** — too many issues with shared `.git` state, hooks, and node_modules. Use a full `git clone`.

## TL;DR Recipe

For a clone numbered `N` (e.g. `2`):

```bash
# 1. Clone from the local primary (fastest, brings all local branches)
git clone /Users/kurtlee/Work/serverless-agent /Users/kurtlee/Work/serverless-agent-N --origin temp
cd /Users/kurtlee/Work/serverless-agent-N
git remote set-url temp git@github.com:breath103/serverless-agent.git
git remote rename temp origin
git remote add template git@github.com:breath103/tss-stack-template.git
git checkout <branch-you-want>

# 2. Copy gitignored env files from primary
cp /Users/kurtlee/Work/serverless-agent/.env .env
cp /Users/kurtlee/Work/serverless-agent/packages/backend/.env.development packages/backend/.env.development
cp /Users/kurtlee/Work/serverless-agent/packages/frontend/.env.development packages/frontend/.env.development

# 3. Write tss.override.json with a unique worktree id + non-overlapping ports
#    (see "Choosing ports" below)
cat > tss.override.json <<JSON
{
  "dev": { "worktree": "N" },
  "edge":     { "devPort": 60N1 },
  "backend":  { "devPort": 60N2 },
  "frontend": { "devPort": 60N0 }
}
JSON

# 4. Bump MQTT namespace in backend env so the two instances don't share IoT topics
#    Edit packages/backend/.env.development:
#    AGENT_MQTT_NAMESPACE="serverless-agent-dev-N"

# 5. Install
npm install

# 6. Start dev servers
./scripts/dev.ts start

# 7. CRITICAL: bootstrap DynamoDB Local — `dev.ts start` does NOT do this
./packages/backend/scripts/ddb-local.ts bootstrap
#    → spins up `serverless-agent-N-ddb-local` container, creates tables, seeds admin/admin
```

Then open the URL printed by `dev.ts start` (e.g. http://localhost:6011) and log in with `admin` / `admin`.

## Why each step matters

### The `dev.worktree` discriminator

`packages/shared/src/config.ts` exposes:

```ts
export function namespace(cfg) {
  return `${cfg.project}-${cfg.dev.worktree}`;   // e.g. "serverless-agent-2"
}
export function portOffset(id) {
  // deterministic small hash → DDB Local port
}
```

This `namespace` is used everywhere a per-checkout resource needs a stable, unique identity:

| Resource | Derivation |
|---|---|
| DDB Local container name | `${namespace}-ddb-local` |
| DDB Local host port | `30000 + portOffset(namespace)` |
| E2E Chrome status file | `.e2e-status-${namespace}.json` |
| (anything else added later) | follows the same pattern |

So bumping `dev.worktree` from `"1"` → `"2"` automatically isolates the DDB container and e2e profile. **No other changes** are needed for those.

### What's NOT auto-isolated — you must set manually

- **Dev ports** (`edge.devPort`, `backend.devPort`, `frontend.devPort`) — these come straight from `tss.json` / `tss.override.json`. Set them yourself in the override.
- **MQTT namespace** (`AGENT_MQTT_NAMESPACE` in `packages/backend/.env.development`) — both instances point at the same real AWS IoT broker; without different namespaces they'd publish to overlapping topics and step on each other. Suffix with `-N`.
- **Google OAuth redirect URI** — the Google Cloud Console only has `http://localhost:<edge.devPort>/api/skills/oauth/callback` registered for the *primary* edge port. OAuth-based skills (Google Calendar etc.) won't work from a non-primary clone unless you add a second redirect URI in Google Cloud Console. Login + memory + chat + web-search work fine.

### Why `./scripts/dev.ts start` is not enough

This is the easy thing to miss. The dev orchestrator (`scripts/dev.ts`) spawns four child processes: `backend`, `frontend`, `edge`, `types`. It does **not** start the DynamoDB Local docker container. It assumes one is already running and reachable at `DDB_LOCAL_ENDPOINT` (which the backend's `server.ts` derives from `${project}-${dev.worktree}` automatically).

So the canonical first-time-up sequence is:

```bash
./scripts/dev.ts start                              # processes ready, but DB not running
./packages/backend/scripts/ddb-local.ts bootstrap   # docker run + create-tables + seed-admin
```

`bootstrap` is the all-in-one subcommand. Equivalent to `up` + `create-tables` + `seed-admin`. Other subcommands: `up`, `down`, `create-tables`, `delete-tables`, `reset`, `seed-admin`.

On subsequent restarts the container persists (docker keeps it running) so you can just do `./scripts/dev.ts start` again — but check `docker ps --filter name=ddb-local` first; if your container isn't there, `bootstrap` it again.

## Choosing ports

The primary uses 6000/6001/6002 (frontend/edge/backend). Pick a different 60N0/60N1/60N2 block for each clone. Suggested scheme:

| Instance | frontend | edge | backend | DDB Local (auto) |
|---|---|---|---|---|
| Primary (`worktree=1`) | 6000 | 6001 | 6002 | hash → 30609 |
| Clone 2 (`worktree=2`) | 6010 | 6011 | 6012 | hash → 30610 |
| Clone 3 (`worktree=3`) | 6020 | 6021 | 6022 | hash → ... |

DDB Local port is auto-derived — don't try to set it. Only the three app ports go in `tss.override.json`.

## Verifying it works (e2e)

```bash
./scripts/e2e.ts start            # headless Chrome, per-namespace status file
./scripts/e2e.ts navigate /
./scripts/e2e.ts type "input[name=username]" "admin"
./scripts/e2e.ts type "input[name=password]" "admin"
./scripts/e2e.ts click "button[type=submit]"
./scripts/e2e.ts run-js "location.href"   # should be /dashboard/memories
```

If login fails: confirm `docker ps` shows `serverless-agent-N-ddb-local`. If it's missing, you forgot the `bootstrap` step.

## Files to copy / files that auto-generate

**Must copy from primary** (gitignored, holds secrets/local state):
- `.env`
- `packages/backend/.env.development`
- `packages/frontend/.env.development`

**Must write fresh** in the clone:
- `tss.override.json` — with the new `worktree` id and ports

**Auto-generated on first run** — don't touch:
- `.dev-status.json`
- `.e2e-status-${project}-${dev.worktree}.json`
- `node_modules/` (created by `npm install`)
- DDB Local docker container (created by `ddb-local.ts bootstrap`)

## Cleanup

To tear down a clone fully:

```bash
./scripts/dev.ts stop                                   # in the clone dir
./packages/backend/scripts/ddb-local.ts down            # stop + remove docker container
./scripts/e2e.ts stop                                   # if you started e2e
rm -rf /Users/kurtlee/Work/serverless-agent-N
```

## Common mistakes (history)

1. **Forgetting `ddb-local.ts bootstrap`.** Dev servers report "ready" but every DB call 500s. The CLAUDE.md / dev.md docs imply `dev.ts start` is the only command — it isn't. **Bootstrap DDB Local right after `dev.ts start` on every fresh clone.**
2. **Cloning from GitHub instead of the local primary.** Local-only branches (anything not yet pushed) won't be in the clone. Cloning from `/Users/kurtlee/Work/serverless-agent` brings every local branch in one shot; then re-point `origin` to GitHub.
3. **Using `git worktree` instead of full clone.** Sharing `.git`, hooks, and `node_modules` between worktrees creates more pain than it saves. Just clone.
4. **Not bumping `AGENT_MQTT_NAMESPACE`.** Two instances publishing to the same MQTT topic set will deliver messages to the wrong UIs.
5. **Expecting Google OAuth to work on a non-primary port.** It won't — the redirect URI is hardcoded in Google Cloud Console to the primary edge port. Either register another redirect URI or accept that OAuth-skills won't authenticate on clone N.
