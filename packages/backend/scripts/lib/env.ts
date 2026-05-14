import path from "node:path";

import { config as dotenvConfig } from "dotenv";
import { loadAndValidateEnv } from "shared/env-parser";

import { localDdbEndpoint } from "./ddb_local.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const REPO_ROOT = path.resolve(ROOT, "../..");

export function loadEnv(env: string): Record<string, string> {
  // Load repo-root .env first (AWS_PROFILE etc.) — overrides any
  // shell-level vars so the project's .env is authoritative. The
  // package-specific .env.<env> then layers on top.
  dotenvConfig({ path: path.join(REPO_ROOT, ".env"), override: true });

  const envFile = `.env.${env}`;
  dotenvConfig({ path: path.join(ROOT, envFile), override: true });
  console.log(`Loaded environment from ${envFile}`);

  // Local DynamoDB lives in a per-worktree container — derive its endpoint
  // from `${project}-${dev.worktree}` so the user doesn't have to keep
  // DDB_LOCAL_ENDPOINT in sync with tss.json by hand. Production resolves
  // it from CDK-injected env, so leave it alone.
  if (env === "development") {
    process.env.DDB_LOCAL_ENDPOINT = localDdbEndpoint();
  }

  console.log("Validating environment variables...");
  const envVars = loadAndValidateEnv(path.join(ROOT, "src/env.d.ts"), { skipCdkInjected: true });
  console.log("Environment variables OK\n");

  return envVars;
}
