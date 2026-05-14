import { randomUUID } from "node:crypto";

import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { ddb, tables } from "../lib/ddb.js";
import type { UserRow } from "../types/database.js";

export const usersRepo = {
  async getById(id: string): Promise<UserRow | null> {
    const res = await ddb.get().send(new GetCommand({
      TableName: tables.users(),
      Key: { id },
    }));
    return (res.Item as UserRow | undefined) ?? null;
  },

  async getByUsername(username: string): Promise<UserRow | null> {
    const res = await ddb.get().send(new QueryCommand({
      TableName: tables.users(),
      IndexName: "by-username",
      KeyConditionExpression: "username = :u",
      ExpressionAttributeValues: { ":u": username },
      Limit: 1,
    }));
    const items = res.Items as UserRow[] | undefined;
    return items && items.length > 0 ? items[0] : null;
  },

  async create(input: { username: string; passwordHash: string; name: string }): Promise<UserRow> {
    const now = new Date().toISOString();
    const row: UserRow = {
      id: randomUUID(),
      username: input.username,
      password_hash: input.passwordHash,
      name: input.name,
      created_at: now,
      updated_at: now,
    };
    await ddb.get().send(new PutCommand({
      TableName: tables.users(),
      Item: row,
      // Cheap guard against ID collisions — randomUUID has enough entropy
      // that this should never trigger.
      ConditionExpression: "attribute_not_exists(id)",
    }));
    return row;
  },
};
