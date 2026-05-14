#!/usr/bin/env -S node --import tsx
import { parseArgs } from "node:util";

import { frontendBucketName, loadConfig } from "shared/config";

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

async function main() {
  parseCliArgs();

  const config = loadConfig();
  const bucketName = frontendBucketName(config);
  const s3 = new S3Client({ region: "us-east-1" });

  console.log(`\nDeleting all frontend assets from s3://${bucketName}/...`);
  await deleteAll(s3, bucketName);

  console.log("\n✅ Destroyed frontend");
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
Usage: ./packages/frontend/scripts/destroy.ts [options]

Delete all frontend assets from S3

Options:
  -h, --help          Show this help message
`);
  process.exit(0);
}

async function deleteAll(s3: S3Client, bucket: string): Promise<void> {
  let continuationToken: string | undefined;
  let totalDeleted = 0;

  do {
    const listResponse = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );

    const objects = listResponse.Contents;
    if (!objects || objects.length === 0) {
      if (totalDeleted === 0) {
        console.log("No objects found.");
      }
      break;
    }

    const deleteParams = {
      Bucket: bucket,
      Delete: {
        Objects: objects.map((obj) => ({ Key: obj.Key! })),
        Quiet: true,
      },
    };

    await s3.send(new DeleteObjectsCommand(deleteParams));
    totalDeleted += objects.length;
    console.log(`  Deleted ${objects.length} objects (total: ${totalDeleted})`);

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  if (totalDeleted > 0) {
    console.log(`Deleted ${totalDeleted} objects from s3://${bucket}/`);
  }
}

void main();
