#!/usr/bin/env -S node --import tsx
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

import * as cdk from "aws-cdk-lib";
import { build } from "esbuild";
import { frontendBucketName, loadConfig } from "shared/config";

import { EdgeStack } from "./lib/edge-stack.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");

async function main() {
  const { command, dryRun } = parseCliArgs();

  const config = loadConfig();

  await buildEdgeFunctions({
    project: config.project,
    ssmRegion: config.ssm.region,
  });

  const stackId = synthesizeStack({
    project: config.project,
    ssmRegion: config.ssm.region,
    frontendBucketName: frontendBucketName(config),
    githubActionsIamRole: config.edge.githubActionsIamRole
      ? { repo: config.repo }
      : undefined,
  });

  switch (command) {
    case "deploy":
      deploy(stackId, dryRun);
      break;
    case "destroy":
      await destroy(stackId);
      break;
  }
}

function parseCliArgs() {
  const { values, positionals } = parseArgs({
    options: {
      "dry-run": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    showHelp();
  }

  const command = positionals[0];
  if (command !== "deploy" && command !== "destroy") {
    showHelp();
  }

  return { command: command as "deploy" | "destroy", dryRun: values["dry-run"] };
}

function showHelp(): never {
  console.log(`
Usage: ./packages/edge/scripts/deploy.ts <command> [options]

Deploy or destroy the edge stack (CloudFront, Lambda@Edge, S3)

Commands:
  deploy              Deploy the edge stack
  destroy             Destroy the edge stack (with confirmation)

Options:
  --dry-run           Build and synthesize only, skip actual deployment
  -h, --help          Show this help message

Examples:
  ./packages/edge/scripts/deploy.ts deploy
  ./packages/edge/scripts/deploy.ts deploy --dry-run
  ./packages/edge/scripts/deploy.ts destroy
`);
  process.exit(0);
}

interface BuildOptions {
  project: string;
  ssmRegion: string;
}

async function buildEdgeFunctions(opts: BuildOptions) {
  console.log("Building edge functions...");
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // Build origin-request Lambda@Edge
  await build({
    entryPoints: [path.join(ROOT, "src/origin-request/index.ts")],
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    outfile: path.join(DIST, "origin-request/index.js"),
    define: {
      "process.env.PROJECT": JSON.stringify(opts.project),
      "process.env.SSM_REGION": JSON.stringify(opts.ssmRegion),
    },
  });
}

import type { EdgeStackConfig } from "./lib/edge-stack.js";

function synthesizeStack(config: EdgeStackConfig): string {
  console.log(`  project: ${config.project}`);
  console.log(`  ssm.region: ${config.ssmRegion}`);

  const app = new cdk.App({ outdir: path.join(ROOT, "cdk.out") });
  const stackId = EdgeStack.id({ project: config.project });

  const stack = new EdgeStack(app, {
    config,
    env: { account: process.env.CDK_DEFAULT_ACCOUNT },
  });

  cdk.Tags.of(stack).add("project", config.project);
  app.synth();

  return stackId;
}

function deploy(stackId: string, dryRun: boolean | undefined) {
  console.log(`\nDeploying ${stackId}...`);

  if (dryRun) {
    console.log("\n--dry-run: Skipping CDK deploy");
    console.log(`Built files in ${DIST}:`);
    execSync(`ls -la ${DIST}`, { stdio: "inherit" });
  } else {
    execSync(
      `npx cdk deploy ${stackId} --app ./cdk.out --require-approval never`,
      { stdio: "inherit", cwd: ROOT }
    );
  }
}

async function destroy(stackId: string) {
  console.log(`\nThis will destroy the stack: ${stackId}`);
  console.log("  - CloudFront distribution");
  console.log("  - Lambda@Edge functions");

  const confirmed = await confirm("\nAre you sure you want to destroy?");
  if (!confirmed) {
    console.log("Aborted.");
    process.exit(0);
  }

  console.log(`\nDestroying ${stackId}...`);
  execSync(
    `npx cdk destroy ${stackId} --app ./cdk.out`,
    { stdio: "inherit", cwd: ROOT }
  );
}

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

main();
