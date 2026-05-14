import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { ddb, tables } from "../lib/ddb.js";
import type { SessionRow } from "../types/database.js";

export const sessionsRepo = {
  async get(id: string): Promise<SessionRow | null> {
    const res = await ddb.get().send(new GetCommand({
      TableName: tables.sessions(),
      Key: { id },
    }));
    return (res.Item as SessionRow | undefined) ?? null;
  },

  async create(input: { id: string; userId: string; expiresAt: Date }): Promise<SessionRow> {
    const row: SessionRow = {
      id: input.id,
      user_id: input.userId,
      expires_at: input.expiresAt.toISOString(),
      expires_at_epoch: Math.floor(input.expiresAt.getTime() / 1000),
      created_at: new Date().toISOString(),
    };
    await ddb.get().send(new PutCommand({
      TableName: tables.sessions(),
      Item: row,
    }));
    return row;
  },

  async delete(id: string): Promise<void> {
    await ddb.get().send(new DeleteCommand({
      TableName: tables.sessions(),
      Key: { id },
    }));
  },
};
