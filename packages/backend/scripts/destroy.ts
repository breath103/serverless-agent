#!/usr/bin/env -S node --import tsx
import { parseArgs } from "node:util";

import { loadConfig } from "shared/config";
import * as SSMParameters from "shared/ssm-parameters";

import {
  CloudFormationClient,
  DeleteStackCommand,
  waitUntilStackDeleteComplete,
} from "@aws-sdk/client-cloudformation";
import {
  DeleteParameterCommand,
  ParameterNotFound,
  SSMClient,
} from "@aws-sdk/client-ssm";

import { BackendStack } from "./lib/backend-stack.js";

async function main() {
  parseCliArgs();

  const config = loadConfig();
  const stackName = BackendStack.id({ project: config.project });

  console.log(`\nDestroying backend stack: ${stackName}`);

  await deleteStack(stackName, config.backend.region);
  await deleteSsmParameter(config);

  console.log("\n✅ Destroyed backend");
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (values.help) {
    showHelp();
  }
}

function showHelp(): never {
  console.log(`
Usage: ./packages/backend/scripts/destroy.ts [options]

Destroy backend stack from AWS

Options:
  -h, --help          Show this help message
`);
  process.exit(0);
}

async function deleteStack(stackName: string, region: string): Promise<void> {
  const client = new CloudFormationClient({ region });

  console.log(`Deleting CloudFormation stack: ${stackName}...`);

  await client.send(new DeleteStackCommand({ StackName: stackName }));

  console.log("Waiting for stack deletion to complete...");
  await waitUntilStackDeleteComplete(
    { client, maxWaitTime: 600 },
    { StackName: stackName }
  );

  console.log(`Stack ${stackName} deleted successfully`);
}

async function deleteSsmParameter(
  config: ReturnType<typeof loadConfig>
): Promise<void> {
  const client = new SSMClient({ region: config.ssm.region });
  const ssmPath = SSMParameters.backendUrlName({ project: config.project });

  console.log(`\nDeleting SSM parameter: ${ssmPath}`);

  try {
    await client.send(new DeleteParameterCommand({ Name: ssmPath }));
    console.log(`SSM parameter ${ssmPath} deleted successfully`);
  } catch (error) {
    if (error instanceof ParameterNotFound) {
      console.log(`Note: SSM parameter ${ssmPath} does not exist`);
    } else {
      throw error;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
