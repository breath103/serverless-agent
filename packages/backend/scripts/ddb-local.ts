#!/usr/bin/env -S node --import tsx
import { spawnSync } from "node:child_process";

import { loadConfig } from "shared/config";

import type { CreateTableCommandInput } from "@aws-sdk/client-dynamodb";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ResourceInUseException,
  ResourceNotFoundException,
  UpdateTimeToLiveCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";

import { accountsRepo } from "../src/accounts/accounts-repository.js";
import { ddbTables } from "../src/lib/ddb.js";
import { profilesRepo } from "../src/profiles/profiles-repository.js";
import { localContainerName, localDdbEndpoint, localDdbPort } from "./lib/ddb_local.js";
import { DEV_ADMIN_USER_ID } from "./lib/dev-auth.js";
import { loadEnv } from "./lib/env.js";

// Load .env.development so the repos pick up TABLE_NAME_PREFIX etc.
// (DDB_LOCAL_ENDPOINT is overridden in lib/env.ts to point at the worktree's
// container, so any value in .env.development is ignored.)
loadEnv("development");

const config = loadConfig();

const ENDPOINT = localDdbEndpoint(config);
const PORT = localDdbPort(config);
const CONTAINER_NAME = localContainerName(config);
const IMAGE = "amazon/dynamodb-local";

const TABLE_PREFIX = process.env.TABLE_NAME_PREFIX;

const client = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: "local",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});

type TableSpec = {
  name: string;
  input: CreateTableCommandInput;
  ttlAttribute?: string;
};

const tables: TableSpec[] = [
  {
    name: `${TABLE_PREFIX}-users`,
    input: {
      TableName: `${TABLE_PREFIX}-users`,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    },
  },
  {
    name: `${TABLE_PREFIX}-accounts`,
    input: {
      TableName: `${TABLE_PREFIX}-accounts`,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "user_id", AttributeType: "S" },
        { AttributeName: "provider", AttributeType: "S" },
        { AttributeName: "sub", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "user_id", KeyType: "HASH" },
        { AttributeName: "provider", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "by-provider-sub",
          KeySchema: [
            { AttributeName: "provider", KeyType: "HASH" },
            { AttributeName: "sub", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    },
  },
  {
    name: `${TABLE_PREFIX}-sessions`,
    input: {
      TableName: `${TABLE_PREFIX}-sessions`,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    },
    ttlAttribute: "expires_at_epoch",
  },
  {
    name: `${TABLE_PREFIX}-profiles`,
    input: {
      TableName: `${TABLE_PREFIX}-profiles`,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [{ AttributeName: "user_id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "user_id", KeyType: "HASH" }],
    },
  },
  {
    name: `${TABLE_PREFIX}-memories`,
    input: {
      TableName: `${TABLE_PREFIX}-memories`,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "user_id", AttributeType: "S" },
        { AttributeName: "id", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "user_id", KeyType: "HASH" },
        { AttributeName: "id", KeyType: "RANGE" },
      ],
    },
  },
  {
    name: `${TABLE_PREFIX}-chat-sessions`,
    input: {
      TableName: `${TABLE_PREFIX}-chat-sessions`,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "user_id", AttributeType: "S" },
        { AttributeName: "id", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "user_id", KeyType: "HASH" },
        { AttributeName: "id", KeyType: "RANGE" },
      ],
    },
  },
  {
    name: `${TABLE_PREFIX}-chat-messages`,
    input: {
      TableName: `${TABLE_PREFIX}-chat-messages`,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "session_id", AttributeType: "S" },
        { AttributeName: "created_at_id", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "session_id", KeyType: "HASH" },
        { AttributeName: "created_at_id", KeyType: "RANGE" },
      ],
    },
  },
  {
    name: `${TABLE_PREFIX}-user-skills`,
    input: {
      TableName: `${TABLE_PREFIX}-user-skills`,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "user_id", AttributeType: "S" },
        { AttributeName: "id", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "user_id", KeyType: "HASH" },
        { AttributeName: "id", KeyType: "RANGE" },
      ],
    },
  },
];

function dockerPs(filter: string): string {
  const r = spawnSync("docker", ["ps", "-a", "--filter", filter, "--format", "{{.Names}}\t{{.State}}"], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`docker ps failed: ${r.stderr}`);
  return r.stdout.trim();
}

function containerState(): "running" | "stopped" | "absent" {
  const out = dockerPs(`name=^${CONTAINER_NAME}$`);
  if (!out) return "absent";
  const [, state] = out.split("\t");
  return state === "running" ? "running" : "stopped";
}

async function cmdUp() {
  const state = containerState();
  if (state === "running") {
    console.log(`${CONTAINER_NAME} already running on ${ENDPOINT}`);
    return;
  }
  if (state === "stopped") {
    const r = spawnSync("docker", ["start", CONTAINER_NAME], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("docker start failed");
    console.log(`${CONTAINER_NAME} started`);
  } else {
    const r = spawnSync("docker", ["run", "-d", "--name", CONTAINER_NAME, "-p", `${PORT}:8000`, IMAGE], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("docker run failed");
    console.log(`${CONTAINER_NAME} launched on ${ENDPOINT}`);
  }
  await waitForReady();
}

function cmdDown() {
  const state = containerState();
  if (state === "absent") {
    console.log(`${CONTAINER_NAME} not present`);
    return;
  }
  spawnSync("docker", ["rm", "-f", CONTAINER_NAME], { stdio: "inherit" });
  console.log(`${CONTAINER_NAME} removed`);
}

async function waitForReady() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(ENDPOINT, { method: "GET" });
      // DDB Local responds to any GET with a payload; success means TCP/HTTP is up.
      if (r.status) return;
    } catch {
      /* not ready */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`timed out waiting for ${ENDPOINT}`);
}

async function cmdCreateTables() {
  for (const spec of tables) {
    try {
      await client.send(new CreateTableCommand(spec.input));
      await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: spec.name });
      console.log(`created ${spec.name}`);
    } catch (err) {
      if (err instanceof ResourceInUseException) {
        console.log(`exists   ${spec.name}`);
      } else {
        throw err;
      }
    }
    if (spec.ttlAttribute) {
      try {
        await client.send(new UpdateTimeToLiveCommand({
          TableName: spec.name,
          TimeToLiveSpecification: { Enabled: true, AttributeName: spec.ttlAttribute },
        }));
      } catch (err) {
        // TTL is already enabled — DDB Local throws a generic ValidationException; swallow.
        if (!(err instanceof Error) || !/TimeToLive is already enabled/i.test(err.message)) {
          throw err;
        }
      }
    }
  }
}

async function cmdDeleteTables() {
  for (const spec of tables) {
    try {
      await client.send(new DeleteTableCommand({ TableName: spec.name }));
      console.log(`deleted  ${spec.name}`);
    } catch (err) {
      if (err instanceof ResourceNotFoundException) {
        console.log(`missing  ${spec.name}`);
      } else {
        throw err;
      }
    }
  }
}

async function cmdSeedAdmin() {
  const existing = await ddbTables.users.get({ id: DEV_ADMIN_USER_ID });
  if (existing) {
    console.log("admin user already exists");
    return;
  }
  const now = new Date().toISOString();
  await ddbTables.users.put({
    id: DEV_ADMIN_USER_ID,
    name: "Admin",
    credits: 100,
    created_at: now,
    updated_at: now,
  });
  await profilesRepo.create(DEV_ADMIN_USER_ID, { name: "Admin" });
  await accountsRepo.create({
    userId: DEV_ADMIN_USER_ID,
    provider: "google",
    sub: "dev-admin",
    email: "admin@example.invalid",
    emailVerified: true,
  });
  console.log(`seeded dev-admin user (id=${DEV_ADMIN_USER_ID})`);
}

async function main() {
  const cmd = process.argv[2] ?? "bootstrap";
  switch (cmd) {
    case "up":
      await cmdUp();
      break;
    case "down":
      cmdDown();
      break;
    case "create-tables":
      await waitForReady();
      await cmdCreateTables();
      break;
    case "delete-tables":
      await waitForReady();
      await cmdDeleteTables();
      break;
    case "reset":
      await waitForReady();
      await cmdDeleteTables();
      await cmdCreateTables();
      await cmdSeedAdmin();
      break;
    case "seed-admin":
      await waitForReady();
      await cmdSeedAdmin();
      break;
    case "bootstrap":
      await cmdUp();
      await cmdCreateTables();
      await cmdSeedAdmin();
      break;
    default:
      console.error(`unknown command: ${cmd}`);
      console.error("usage: ddb-local.ts [up|down|create-tables|delete-tables|reset|seed-admin|bootstrap]");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
