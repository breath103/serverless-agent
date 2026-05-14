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
