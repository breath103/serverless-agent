# CI Deploy on Main — Design

**Status:** proposed
**Issue:** [#21 — CI: auto-deploy backend + frontend on push to main](https://github.com/breath103/serverless-agent/issues/21)
**Date:** 2026-05-21

---

## Problem

Push-to-main currently runs the `check` matrix (build/lint/test) and stops. Every prod release is a manual `./packages/{backend,frontend}/scripts/deploy.ts --env=production` chain. We want push-to-main to deploy backend + frontend automatically. Edge stays manual.

## Approach — one new job in the existing workflow

Add a `deploy` job to `.github/workflows/deploy.yml`. It:
- `needs: check` — won't run if any of the 3 check jobs fail.
- `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` — skips PR builds, skips other branches.
- `runs-on: self-hosted` — matches `cleanup.yml`. The self-hosted runner already has Node 24, npm, AWS CLI, and the AWS-CLI defaults the deploy scripts depend on (e.g. CDK reads `CDK_DEFAULT_ACCOUNT`, the deploy script shells out to `aws cloudformation describe-stacks` and `aws ssm put-parameter`).
- OIDC auth via `aws-actions/configure-aws-credentials@v4` + `secrets.AWS_ROLE_ARN` — identical to the cleanup workflow's auth step.

### Steps inside the deploy job

```
1. checkout + setup-node + npm ci
2. aws-actions/configure-aws-credentials (OIDC, role from AWS_ROLE_ARN)
3. Write packages/backend/.env.production from GH Secrets
4. Write packages/frontend/.env.production from GH Secrets
5. ./packages/backend/scripts/deploy.ts --env=production
6. ./packages/frontend/scripts/deploy.ts --env=production
```

Backend first because its CDK output writes the Lambda Function URL into SSM — the edge stack's existing Lambda@Edge reads that on its next cold start, picking up changes without any edge redeploy. Frontend after because the dist needs the latest `AGENT_STORAGE_URL` baked in.

### What the deploy scripts already do

The existing scripts are CI-ready; nothing in them needs changing:
- `deploy.ts` reads `--env=production` and loads `packages/backend/.env.production` (or `packages/frontend/.env.production`) via `dotenv`.
- Backend deploy: builds, gets IoT endpoint, synthesizes CDK stack with `envVars` baked into Lambda environment, deploys via `npx cdk deploy --require-approval never`, then writes Function URL to SSM.
- Frontend deploy: vite build with `.env.production` baked in, uploads `dist/` to S3 with per-pattern cache headers from `cache.json`.

The only thing the CI needs to do that local dev doesn't is **materialize the `.env.production` files**.

---

## GitHub Secrets — required

| Secret | Used by | Notes |
|---|---|---|
| `AWS_ROLE_ARN` | both | Already configured for `cleanup.yml`. OIDC role with deploy permissions. |
| `TAVILY_API_KEY` | backend | Web-search skill. |
| `GOOGLE_CLIENT_ID` | backend | Google OAuth + Calendar skill. |
| `GOOGLE_CLIENT_SECRET` | backend | Same. |
| `AGENT_MQTT_NAMESPACE` | backend | Per-project MQTT topic prefix; not `@cdk-injected`, so must be set. |
| `AGENT_STORAGE_URL` | frontend | Public S3 URL of the agent-storage bucket created by backend deploy. Format: `https://<project>-backend-agents.s3.amazonaws.com`. Can be derived from `tss.json:project` but for now we keep it as an explicit secret so the user controls it. |

Optional (skip if unset):
- `POSTHOG_KEY`, `POSTHOG_HOST` — analytics, both backend + frontend.
- `AXIOM_API_TOKEN`, `AXIOM_DATASET` — backend observability.

`TABLE_NAME_PREFIX`, `AGENT_STORAGE_BUCKET`, `AGENT_MQTT_BROKER_URL`, `AGENT_MQTT_ROLE_ARN`, `AGENT_WORKER_FUNCTION_NAME`, `EDGE_PUBLIC_URL` — all `@cdk-injected` per `env.d.ts`. CI doesn't supply them.

### .env file materialization in CI

A single shell step writes both files using `>` redirection of inline `cat <<EOF` blocks. Optional secrets are conditionally appended with `if:` guards (skip the line if the secret is empty). Files are written into the job workspace and the deploy scripts read them via `dotenv`.

---

## Files

### Modify

- `.github/workflows/deploy.yml` — add `deploy` job (~40 lines).

### No changes

- `packages/backend/scripts/deploy.ts` — already takes `--env=production`.
- `packages/frontend/scripts/deploy.ts` — same.
- `packages/edge/scripts/deploy.ts` — out of scope; remains a manual one-shot.

### No production env files committed

`.env.production` files are written at job runtime from secrets, then thrown away when the job ends. Nothing gets committed to git.

---

## Risks / open questions

1. **`AGENT_STORAGE_URL` derivation.** Currently treated as an opaque secret. A follow-up could derive it from `tss.json:project` in the frontend build to drop one secret. Out of scope here.
2. **Concurrent deploys.** `concurrency: deploy-${{ github.ref }}` + `cancel-in-progress: false` to serialize. CDK doesn't like racing.
3. **First-time deploy.** This workflow assumes the edge stack already exists (created by manual `./packages/edge/scripts/deploy.ts deploy`). The README's "Order matters on the first deploy" note covers that.
4. **Self-hosted runner availability.** `cleanup.yml` already depends on it; same dependency here.
5. **Deploy failures mid-way.** Backend deploys, frontend fails → mismatched dist + Lambda. Acceptable for demo; rollback is manual.

---

## Acceptance

- A push to `main` after this PR lands triggers the deploy job (visible in Actions).
- The deploy job is skipped on PR branches.
- Backend Lambda env contains the secrets from GH.
- Frontend dist on S3 has the latest commit's build.
- No `.env.production` files appear in git.
