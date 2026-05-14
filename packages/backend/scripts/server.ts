process.title = "dev:backend:server";

import path from "node:path";

import { loadConfig } from "shared/config";
import { loadAndValidateEnv } from "shared/env-parser";

import { serve } from "@hono/node-server";

import { localDdbEndpoint } from "./lib/ddb_local.js";

async function main(): Promise<void> {
  const config = loadConfig();

  //
  // Validate env vars (already loaded by with-env.sh)
  //
  loadAndValidateEnv(path.join(import.meta.dirname, "../src/env.d.ts"), {
    override: {
      // Per-worktree DDB Local container — derived from ${project}-${dev.worktree}
      // so multiple worktrees don't share state.
      DDB_LOCAL_ENDPOINT: localDdbEndpoint(config),
    },
  });

  //
  // Local dev api server
  //
  const { app } = await import("../src/lambda-api/hono.js");
  serve({ fetch: app.fetch, port: config.backend.devPort });
  console.log(`Backend running on http://localhost:${config.backend.devPort}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
