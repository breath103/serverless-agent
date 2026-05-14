#!/usr/bin/env -S node --import tsx
import { parseArgs } from "node:util";

import { askConfirmation, parseDuration, sleep } from "shared/cli-utils";
import { loadConfig } from "shared/config";

import { CloudWatchLogsClient, FilterLogEventsCommand, ResourceNotFoundException } from "@aws-sdk/client-cloudwatch-logs";

import { BackendStack } from "./lib/backend-stack.js";

const FETCH_LIMIT = 100;
const MAX_EVENTS_BEFORE_CONFIRMATION = 100;

type LambdaFunction = "api";

const LAMBDA_FUNCTIONS: Record<LambdaFunction, { suffix: string; description: string }> = {
  api: { suffix: "", description: "API handler" },
};

interface CliArgs {
  function: LambdaFunction;
  startTime: number;
  tail: boolean;
}

async function main() {
  const args = parseCliArgs();
  const config = loadConfig();
  const region = config.backend.region;
  const baseName = BackendStack.functionName({ project: config.project });
  const { suffix, description } = LAMBDA_FUNCTIONS[args.function];
  const functionName = `${baseName}${suffix}`;

  console.log(`${args.tail ? "Tailing" : "Fetching"} logs for ${functionName} (${description})...\n`);
  await fetchLogs(`/aws/lambda/${functionName}`, region, args.startTime, args.tail);
}

function parseCliArgs(): CliArgs {
  const { values } = parseArgs({
    options: {
      function: { type: "string", short: "f" },
      startTime: { type: "string", short: "s" },
      tail: { type: "boolean", short: "t" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (values.help) {
    console.log(`
Usage: ./packages/backend/scripts/logs.ts [options]

Fetch or tail CloudWatch logs for backend Lambda

Options:
  -f, --function <fn>     Lambda function to read logs from (default: api)
                          api - API handler (HTTP)
  -s, --startTime <dur>   How far back to fetch logs (default: 1m)
                          Format: <number><unit> where unit is s/m/h/d
                          Examples: 30s, 5m, 1h, 7d
  -t, --tail              Keep tailing logs (default: fetch once and exit)
  -h, --help              Show this help message

Examples:
  ./packages/backend/scripts/logs.ts          # API logs, last 1 minute
  ./packages/backend/scripts/logs.ts -t       # API logs, tailing
  ./packages/backend/scripts/logs.ts -s 1d -t # API logs, last 1 day, tailing
`);
    process.exit(0);
  }

  const fn = (values.function ?? "api") as LambdaFunction;
  if (!(fn in LAMBDA_FUNCTIONS)) {
    console.error(`Error: --function must be one of: ${Object.keys(LAMBDA_FUNCTIONS).join(", ")}`);
    process.exit(1);
  }

  return {
    function: fn,
    startTime: parseDuration(values.startTime ?? "1m"),
    tail: values.tail ?? false,
  };
}

async function fetchLogs(logGroupName: string, region: string, startTime: number, tail: boolean): Promise<void> {
  const logs = new CloudWatchLogsClient({ region });
  let totalEvents = 0;
  let askedConfirmation = false;
  let nextToken: string | undefined;

  while (true) {
    try {
      const response = await logs.send(
        new FilterLogEventsCommand({ logGroupName, startTime, nextToken, limit: FETCH_LIMIT })
      );

      const events = response.events ?? [];

      for (const event of events) {
        const ts = new Date(event.timestamp!).toISOString();
        const msg = event.message?.trimEnd() ?? "";
        console.log(`${ts}  ${msg}`);
        startTime = event.timestamp! + 1;
      }

      totalEvents += events.length;
      nextToken = response.nextToken;

      if (totalEvents >= MAX_EVENTS_BEFORE_CONFIRMATION && nextToken && !askedConfirmation) {
        const lastTs = events.at(-1)?.timestamp;
        const lastTime = lastTs ? new Date(lastTs).toISOString() : "N/A";
        const confirmed = await askConfirmation(
          `\nRead ${totalEvents} events so far (last: ${lastTime}). Continue until now? (y/n): `
        );
        if (!confirmed) {
          console.log("Stopped.");
          return;
        }
        askedConfirmation = true;
      }

      if (nextToken) continue;
      if (!tail) return;
      await sleep(1000);
    } catch (err) {
      if (err instanceof ResourceNotFoundException) {
        if (!tail) {
          console.log("Log group not found.");
          return;
        }
        console.log("Waiting for log group to be created...");
        await sleep(1000);
      } else {
        throw err;
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
