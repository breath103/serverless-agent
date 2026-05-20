import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import type {
  AccountRow,
  ChatSessionMessageRow,
  ChatSessionRow,
  MemoryRow,
  ProfileRow,
  SessionRow,
  UserRow,
  UserSkillRow,
} from "../types/database.js";
import { singleton } from "./singleton.js";

const docClient = singleton((): DynamoDBDocumentClient => {
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

type DdbKey = Record<string, string | number>;
// eslint-disable-next-line @typescript-eslint/no-restricted-types -- DDB values are any JSON-serializable value; `unknown` is the right type at this boundary
type DdbValues = Record<string, unknown>;
type DdbNames = Record<string, string>;

/**
 * Typed handle for a single DynamoDB table. Repos compose one (or more) of
 * these in their constructor and call its methods — every read/write goes
 * through here, so `GetCommand` / `PutCommand` / pagination loops / casts /
 * `ConditionalCheckFailed → null` translation live in exactly one place.
 *
 * `TKey` is the table's primary-key shape (e.g. `{ user_id: string; id: string }`).
 */
export class DdbTable<TRow, TKey extends DdbKey> {
  constructor(private readonly entity: string) {}

  private get tableName(): string {
    return `${process.env.TABLE_NAME_PREFIX}-${this.entity}`;
  }

  async get(key: TKey): Promise<TRow | null> {
    const res = await docClient.get().send(new GetCommand({
      TableName: this.tableName,
      Key: key,
    }));
    return (res.Item as TRow | undefined) ?? null;
  }

  async put(item: TRow, opts?: { conditionExpression?: string }): Promise<void> {
    await docClient.get().send(new PutCommand({
      TableName: this.tableName,
      Item: item as DdbValues,
      ConditionExpression: opts?.conditionExpression,
    }));
  }

  async delete(key: TKey): Promise<TRow | null> {
    const res = await docClient.get().send(new DeleteCommand({
      TableName: this.tableName,
      Key: key,
      ReturnValues: "ALL_OLD",
    }));
    return (res.Attributes as TRow | undefined) ?? null;
  }

  /** Unconditional update — DDB upserts when the row is missing, so the row is always returned. */
  async update(opts: {
    key: TKey;
    updateExpression: string;
    expressionAttributeNames?: DdbNames;
    expressionAttributeValues?: DdbValues;
  }): Promise<TRow> {
    const res = await docClient.get().send(new UpdateCommand({
      TableName: this.tableName,
      Key: opts.key,
      UpdateExpression: opts.updateExpression,
      ExpressionAttributeNames: opts.expressionAttributeNames,
      ExpressionAttributeValues: opts.expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    }));
    return res.Attributes as TRow;
  }

  /** Conditional update — returns `null` iff `conditionExpression` fails; every other error propagates. */
  async updateIf(opts: {
    key: TKey;
    updateExpression: string;
    conditionExpression: string;
    expressionAttributeNames?: DdbNames;
    expressionAttributeValues?: DdbValues;
  }): Promise<TRow | null> {
    try {
      const res = await docClient.get().send(new UpdateCommand({
        TableName: this.tableName,
        Key: opts.key,
        UpdateExpression: opts.updateExpression,
        ConditionExpression: opts.conditionExpression,
        ExpressionAttributeNames: opts.expressionAttributeNames,
        ExpressionAttributeValues: opts.expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      }));
      return res.Attributes as TRow;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return null;
      throw err;
    }
  }

  /** Paginated query for every row under a single partition key — shortcut over `queryAll`. */
  queryByPartitionKey(name: keyof TKey & string, value: string | number): Promise<TRow[]> {
    return this.queryAll({
      keyConditionExpression: `${name} = :pk`,
      expressionAttributeValues: { ":pk": value },
    });
  }

  /** Paginated query — collects every matching row across all pages. */
  private async queryAll(opts: {
    keyConditionExpression: string;
    expressionAttributeNames?: DdbNames;
    expressionAttributeValues: DdbValues;
    indexName?: string;
    scanIndexForward?: boolean;
  }): Promise<TRow[]> {
    const rows: TRow[] = [];
    let lastKey: DdbValues | undefined;
    do {
      const res = await docClient.get().send(new QueryCommand({
        TableName: this.tableName,
        IndexName: opts.indexName,
        KeyConditionExpression: opts.keyConditionExpression,
        ExpressionAttributeNames: opts.expressionAttributeNames,
        ExpressionAttributeValues: opts.expressionAttributeValues,
        ExclusiveStartKey: lastKey,
        ScanIndexForward: opts.scanIndexForward,
      }));
      rows.push(...((res.Items ?? []) as TRow[]));
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    return rows;
  }

  /** Single-row query (`Limit: 1`). */
  async queryFirst(opts: {
    keyConditionExpression: string;
    expressionAttributeNames?: DdbNames;
    expressionAttributeValues: DdbValues;
    indexName?: string;
  }): Promise<TRow | null> {
    const res = await docClient.get().send(new QueryCommand({
      TableName: this.tableName,
      IndexName: opts.indexName,
      KeyConditionExpression: opts.keyConditionExpression,
      ExpressionAttributeNames: opts.expressionAttributeNames,
      ExpressionAttributeValues: opts.expressionAttributeValues,
      Limit: 1,
    }));
    const items = res.Items as TRow[] | undefined;
    return items && items.length > 0 ? items[0] : null;
  }

  /** Paginated full-table scan. */
  async scanAll(): Promise<TRow[]> {
    const rows: TRow[] = [];
    let lastKey: DdbValues | undefined;
    do {
      const res = await docClient.get().send(new ScanCommand({
        TableName: this.tableName,
        ExclusiveStartKey: lastKey,
      }));
      rows.push(...((res.Items ?? []) as TRow[]));
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    return rows;
  }
}

export const ddbTables = {
  users: new DdbTable<UserRow, { id: string }>("users"),
  accounts: new DdbTable<AccountRow, { user_id: string; provider: string }>("accounts"),
  sessions: new DdbTable<SessionRow, { id: string }>("sessions"),
  profiles: new DdbTable<ProfileRow, { user_id: string }>("profiles"),
  memories: new DdbTable<MemoryRow, { user_id: string; id: string }>("memories"),
  chatSessions: new DdbTable<ChatSessionRow, { user_id: string; id: string }>("chat-sessions"),
  chatMessages: new DdbTable<ChatSessionMessageRow, { session_id: string; created_at_id: string }>("chat-messages"),
  userSkills: new DdbTable<UserSkillRow, { user_id: string; id: string }>("user-skills"),
};
