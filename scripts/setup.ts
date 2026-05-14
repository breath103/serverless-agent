#!/usr/bin/env -S node --import tsx
import * as readline from "readline";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function askProject(): Promise<string> {
  const project = await ask("Project name (lowercase, no spaces): ");
  if (!/^[a-z][a-z0-9-]*$/.test(project)) {
    console.error("Error: Project name must be lowercase, start with letter, only contain a-z, 0-9, -");
    process.exit(1);
  }
  return project;
}

async function askRepo(): Promise<string> {
  const repo = await ask("GitHub repo (org/repo): ");
  if (!/^[^/]+\/[^/]+$/.test(repo)) {
    console.error("Error: Repo must be in format org/repo");
    process.exit(1);
  }
  return repo;
}

async function askRegion(): Promise<string> {
  const defaultRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  return (await ask(`AWS region for backend [${defaultRegion}]: `)) || defaultRegion;
}

function buildConfig(project: string, repo: string, region: string) {
  return {
    $schema: "./tss.schema.json",
    project,
    repo,
    edge: { devPort: 3000 },
    backend: { region, devPort: 3001 },
    frontend: { bucketSuffix: "", devPort: 3002 },
    ssm: { region },
  };
}

function writeConfig(config: ReturnType<typeof buildConfig>) {
  const configPath = path.join(ROOT, "tss.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`Wrote ${configPath}`);
}

function copyEnvSamples() {
  const packages = ["backend", "frontend"];
  for (const pkg of packages) {
    const samplePath = path.join(ROOT, "packages", pkg, ".env.sample");
    const envPath = path.join(ROOT, "packages", pkg, ".env");
    if (fs.existsSync(samplePath) && !fs.existsSync(envPath)) {
      fs.copyFileSync(samplePath, envPath);
      console.log(`Copied ${pkg}/.env.sample → ${pkg}/.env`);
    }
  }
}

async function main() {
  console.log("\n🚀 Serverless-Agent Setup\n");

  const project = await askProject();
  const repo = await askRepo();
  const region = await askRegion();

  const config = buildConfig(project, repo, region);

  console.log("\n📋 Configuration:\n");
  console.log(JSON.stringify(config, null, 2));

  const confirm = await ask("\nWrite to tss.json? [y/N]: ");
  if (confirm.toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(0);
  }

  writeConfig(config);
  copyEnvSamples();

  console.log("\nNext steps:");
  console.log("  1. Edit packages/backend/.env with your secrets");
  console.log("  2. ./packages/edge/scripts/deploy.ts deploy  # Deploy CloudFront + Lambda@Edge");
  console.log("  3. ./packages/backend/scripts/deploy.ts --env=production");
  console.log("  4. ./packages/frontend/scripts/deploy.ts --env=production");

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
