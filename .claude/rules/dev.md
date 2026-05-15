# Local Dev & Scripts

All scripts are executable via shebang — run them directly from repo root. No `npm run` needed.

## Root-level scripts

```bash
./scripts/dev.ts start   # Start dev servers in background, wait for ready, print URL
./scripts/dev.ts status  # Check if dev server is running
./scripts/dev.ts stop    # Stop all dev servers
./scripts/dev.ts         # Start dev servers in foreground (interactive)
./scripts/lint           # Run linters across packages
```

## Package scripts

```bash
# Backend
./packages/backend/scripts/deploy.ts --name=main
./packages/backend/scripts/build.ts
./packages/backend/scripts/build-types.ts
./packages/backend/scripts/logs.ts -n main -t

# Frontend
./packages/frontend/scripts/deploy.ts --name=main
./packages/frontend/scripts/build-types.ts
./packages/frontend/scripts/destroy.ts --name=feature-branch

# Edge
./packages/edge/scripts/deploy.ts deploy
./packages/edge/scripts/logs.ts -f origin-request -r us-east-1
```

## Other common commands

```bash
./packages/backend/scripts/lint.ts                     # Lint backend
./packages/backend/scripts/lint.ts --fix               # Lint backend with auto-fix
./packages/frontend/scripts/lint.ts                    # Lint frontend
./packages/frontend/scripts/lint.ts --fix              # Lint frontend with auto-fix
```

## Install packages

```bash
npm install <package> -w backend
npm install -D <package> -w frontend  # as devDependency
```

## Local Dev Access

**To start local dev, use `./scripts/dev.ts start`.** It blocks until all servers (frontend, backend, edge proxy, types) are ready, then prints the URL and exits. **Never curl-poll for readiness** — `start` already waits. If the server is already running, it prints the existing URL.

Always access the app through the **edge proxy** URL printed by `start`/`status`. Never directly access the frontend or backend ports. Do NOT run `./packages/backend/scripts/dev.ts` alone — that only starts the backend and skips the edge proxy.

## Local Dev API Testing

To call backend API endpoints as the authenticated user during local development, pass the `X-Dev-Role: user` header. This only works when `NODE_ENV=development`.

```bash
curl -H "X-Dev-Role: user" http://localhost:<edge.devPort>/api/channels
```

## Local Telegram Testing (real BotFather bot)

Telegram won't deliver webhooks to `localhost` — needs a public HTTPS URL. The install route auto-skips `setWebhook` in dev *unless* you set `EDGE_PUBLIC_URL`. With a free zero-signup tunnel via cloudflared, the full inbound + outbound round-trip works against a real bot.

```bash
# 1. Start a tunnel pointing at the edge proxy. Prints the public URL.
#    cloudflared is preinstalled via Homebrew. No login or account needed for `--url`.
cloudflared tunnel --url http://localhost:6001 --no-autoupdate
#    → https://<random-words>.trycloudflare.com

# 2. Add the URL to packages/backend/.env.development (must be EDGE_PUBLIC_URL — see env.d.ts):
echo 'EDGE_PUBLIC_URL="https://<random-words>.trycloudflare.com"' >> packages/backend/.env.development

# 3. Restart dev so the backend picks up the env (it reads at startup, not per-request):
./scripts/dev.ts stop && ./scripts/dev.ts start

# 4. Verify the tunnel reaches the local backend:
curl https://<random-words>.trycloudflare.com/api/health
#    → {"status":"ok",...}

# 5. Create a bot via @BotFather on Telegram (/newbot, give it a name + @handle),
#    then paste the token into Settings → Skills → Connect Telegram in the web UI.
#    The install route registers setWebhook against the tunnel URL.

# 6. Message the bot on Telegram. The webhook hits the backend through the tunnel
#    and a chat appears in the web sidebar; the agent's reply lands back in Telegram.

# 7. Disconnect via the UI when done — that calls deleteWebhook and removes the row.
```

Caveats:
- The cloudflared "quick tunnel" URL is ephemeral. If you stop and restart cloudflared you get a new URL — update `EDGE_PUBLIC_URL` and restart dev again, otherwise Telegram is still pointing at a dead tunnel.
- A bot token is a secret. Don't commit it. The token lives only inside DynamoDB (`user-skills` row), never in env files or git.

## E2E Browser Testing

Use the headless Chrome CLI to verify UI changes without touching the user's browser. The E2E instance has its own lifecycle, independent of the dev server.

```bash
./scripts/e2e.ts start                  # Start headless Chrome (stores CDP endpoint in .e2e-status.json)
./scripts/e2e.ts stop                   # Stop headless Chrome
./scripts/e2e.ts login                  # Authenticate as dev user
./scripts/e2e.ts navigate /dashboard    # Navigate to a page
./scripts/e2e.ts screenshot             # Take screenshot → .tmp/screenshot-<ts>.png
./scripts/e2e.ts run-js "document.title"  # Run JS in page context
./scripts/e2e.ts click ".button"        # Click an element
./scripts/e2e.ts type "input" "text"    # Type into an element
./scripts/e2e.ts wait ".loaded"         # Wait for element to appear
./scripts/e2e.ts page-text              # Get page text content
```

The headless Chrome persists between commands via CDP.
