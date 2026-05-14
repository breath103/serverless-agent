import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { singleton } from "./singleton.js";

/**
 * DynamoDB document client singleton. The DocumentClient wraps the low-level
 * DynamoDB client with marshalling/unmarshalling so we read/write plain JS
 * objects instead of AttributeValue maps.
 *
 * `removeUndefinedValues: true` lets us `update` with patches that contain
 * `undefined` without crashing — they're simply dropped from the write.
 */
export const ddb = singleton((): DynamoDBDocumentClient => {
  const endpoint = process.env.DDB_LOCAL_ENDPOINT;
  const base = endpoint
    ? new DynamoDBClient({
        endpoint,
        region: "local",
        credentials: { accessKeyId: "local", secretAccessKey: "local" },
      })
    : new DynamoDBClient({});
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: false,
    },
  });
});

// All tables share `${TABLE_NAME_PREFIX}-<entity>` to mirror the CDK stack
// (which sets prefix = `${project}-backend`). One env var, derived names.
function tableName(entity: string): string {
  const prefix = process.env.TABLE_NAME_PREFIX;
  return `${prefix}-${entity}`;
}

export const tables = {
  users: () => tableName("users"),
  sessions: () => tableName("sessions"),
  profiles: () => tableName("profiles"),
  memories: () => tableName("memories"),
  chatSessions: () => tableName("chat-sessions"),
  chatMessages: () => tableName("chat-messages"),
};
