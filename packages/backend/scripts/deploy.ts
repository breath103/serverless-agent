#!/usr/bin/env -S node --import tsx
import { execSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";

import * as cdk from "aws-cdk-lib";
import { loadConfig, type TssConfig } from "shared/config";
import * as SSMParameters from "shared/ssm-parameters";

import { DescribeEndpointCommand, IoTClient } from "@aws-sdk/client-iot";

import { BackendStack } from "./lib/backend-stack.js";
import { loadEnv } from "./lib/env.js";

const ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  const { env } = parseCliArgs();

  const envVars = loadEnv(env);
  build();

  const config = loadConfig();
  const mqttBrokerUrl = await getIotEndpoint(config.backend.region);
  const publicUrl = computePublicUrl(config);
  const stackName = synthesizeStack(config, envVars, mqttBrokerUrl, publicUrl);

  deploy(stackName);
  storeUrlInSsm(stackName, config);

  console.log("\n✅ Deployed backend");
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      env: { type: "string", short: "e" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (values.help) {
    showHelp();
  }

  if (!values.env) {
    console.error("Error: --env is required (e.g., --env=production)");
    console.error("Run with --help for usage information");
    process.exit(1);
  }

  return { env: values.env };
}

function showHelp(): never {
  console.log(`
Usage: ./packages/backend/scripts/deploy.ts [options]

Deploy backend to AWS Lambda

Options:
  -e, --env <env>     Environment file suffix (required)
                      Loads .env.<env>
                      Example: --env=production loads .env.production
  -h, --help          Show this help message

Examples:
  ./packages/backend/scripts/deploy.ts --env=production
  ./packages/backend/scripts/deploy.ts -e staging
`);
  process.exit(0);
}

function build(): void {
  console.log("Building...");
  execSync("./scripts/build.ts", { stdio: "inherit", cwd: ROOT });
}

async function getIotEndpoint(region: string): Promise<string> {
  const iot = new IoTClient({ region });
  const { endpointAddress } = await iot.send(new DescribeEndpointCommand({ endpointType: "iot:Data-ATS" }));
  if (!endpointAddress) throw new Error("Failed to get IoT endpoint");
  return `mqtts://${endpointAddress}:8883`;
}

function computePublicUrl(config: TssConfig): string | undefined {
  if (!config.domain) return undefined;
  const sub = Object.entries(config.subdomainMap).find(([, v]) => v === "main")?.[0];
  return sub ? `https://${sub}.${config.domain}` : `https://${config.domain}`;
}

function synthesizeStack(
  config: TssConfig,
  envVars: Record<string, string>,
  mqttBrokerUrl: string,
  publicUrl: string | undefined,
): string {
  console.log(`\nDeploying to ${config.backend.region} (project: ${config.project})...`);
  if (publicUrl) console.log(`  publicUrl: ${publicUrl}`);

  const app = new cdk.App({ outdir: path.join(ROOT, "cdk.out") });
  const stackId = BackendStack.id({ project: config.project });

  const stack = new BackendStack(app, {
    project: config.project,
    envVars,
    mqttBrokerUrl,
    publicUrl,
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: config.backend.region,
    },
  });

  cdk.Tags.of(stack).add("project", config.project);

  app.synth();
  return stackId;
}

function deploy(stackName: string): void {
  execSync(
    `npx cdk deploy ${stackName} --app ./cdk.out --require-approval never`,
    { stdio: "inherit", cwd: ROOT }
  );
}

function storeUrlInSsm(
  stackName: string,
  config: ReturnType<typeof loadConfig>
): void {
  const functionUrl = execSync(
    `aws cloudformation describe-stacks --stack-name ${stackName} --query 'Stacks[0].Outputs[?OutputKey==\`FunctionUrl\`].OutputValue' --output text --region ${config.backend.region}`,
    { encoding: "utf-8" }
  ).trim();

  const ssmPath = SSMParameters.backendUrlName({ project: config.project });

  console.log(`\nStoring Function URL in SSM: ${ssmPath}`);
  execSync(
    `aws ssm put-parameter --name "${ssmPath}" --value "${functionUrl}" --type String --overwrite --region ${config.ssm.region}`,
    { stdio: "inherit" }
  );

  console.log(`\n✅ Deployed: ${functionUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
