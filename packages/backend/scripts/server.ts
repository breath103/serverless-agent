process.title = "dev:backend:server";

import path from "node:path";

import { loadConfig } from "shared/config";
import { loadAndValidateEnv } from "shared/env-parser";

import { serve } from "@hono/node-server";

import { localDdbEndpoint } from "./lib/ddb_local.js";

async function main(): Promise<void> {
  const config = loadConfig();

  //
  // Validate env vars (already loaded by with-env.sh). In dev we stand in
  // for the Lambda runtime + CDK by injecting the same values they'd supply
  // in prod — so `.env.development` doesn't need to repeat them.
  //
  loadAndValidateEnv(path.join(import.meta.dirname, "../src/env.d.ts"), {
    override: {
      // Per-worktree DDB Local container — derived from ${project}-${dev.worktree}
      // so multiple worktrees don't share state.
      DDB_LOCAL_ENDPOINT: localDdbEndpoint(config),
      // Lambda runtime sets AWS_REGION in prod; dev has no runtime.
      AWS_REGION: config.backend.region,
      // CDK injects EDGE_PUBLIC_URL on the API Lambda from
      // tss.json's domain + subdomainMap; dev points at the edge proxy.
      EDGE_PUBLIC_URL: `http://localhost:${config.edge.devPort}`,
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
