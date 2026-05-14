import { randomUUID } from "node:crypto";

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { ddb, tables } from "../lib/ddb.js";
import type { ChatSessionMessageData } from "../lib/realtime-events.js";
import type { ChatSessionKind, ChatSessionMessageRow, ChatSessionRow } from "../types/database.js";

type DdbKey = Record<string, string>;

async function queryAllSessionsForUser(userId: string): Promise<ChatSessionRow[]> {
  const rows: ChatSessionRow[] = [];
  let lastKey: DdbKey | undefined;
  do {
    const res = await ddb.get().send(new QueryCommand({
      TableName: tables.chatSessions(),
      KeyConditionExpression: "user_id = :u",
      ExpressionAttributeValues: { ":u": userId },
      ExclusiveStartKey: lastKey,
    }));
    rows.push(...((res.Items ?? []) as ChatSessionRow[]));
    lastKey = res.LastEvaluatedKey as DdbKey | undefined;
  } while (lastKey);
  return rows;
}

export const chatSessionsRepo = {
  async listForUser(userId: string): Promise<ChatSessionRow[]> {
    const rows = await queryAllSessionsForUser(userId);
    rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return rows;
  },

  async getByIdForUser(userId: string, id: string): Promise<ChatSessionRow | null> {
    const res = await ddb.get().send(new GetCommand({
      TableName: tables.chatSessions(),
      Key: { user_id: userId, id },
    }));
    return (res.Item as ChatSessionRow | undefined) ?? null;
  },

  async existsForUser(userId: string, id: string): Promise<boolean> {
    const row = await this.getByIdForUser(userId, id);
    return row !== null;
  },

  async createGenerating(userId: string, kind: ChatSessionKind): Promise<ChatSessionRow> {
    const now = new Date().toISOString();
    const row: ChatSessionRow = {
      user_id: userId,
      id: randomUUID(),
      title: null,
      is_generating: true,
      kind,
      created_at: now,
      updated_at: now,
    };
    await ddb.get().send(new PutCommand({
      TableName: tables.chatSessions(),
      Item: row,
    }));
    return row;
  },

  /**
   * Atomically flip is_generating false → true for a session owned by
   * this user. Returns the row on success, null if already generating.
   */
  async beginGenerating(userId: string, id: string): Promise<ChatSessionRow | null> {
    try {
      const res = await ddb.get().send(new UpdateCommand({
        TableName: tables.chatSessions(),
        Key: { user_id: userId, id },
        UpdateExpression: "SET is_generating = :t, updated_at = :u",
        ConditionExpression: "attribute_exists(id) AND is_generating = :f",
        ExpressionAttributeValues: {
          ":t": true,
          ":f": false,
          ":u": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      }));
      return (res.Attributes as ChatSessionRow | undefined) ?? null;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return null;
      throw err;
    }
  },

  async endGenerating(userId: string, id: string): Promise<ChatSessionRow> {
    const res = await ddb.get().send(new UpdateCommand({
      TableName: tables.chatSessions(),
      Key: { user_id: userId, id },
      UpdateExpression: "SET is_generating = :f, updated_at = :u",
      ConditionExpression: "attribute_exists(id)",
      ExpressionAttributeValues: {
        ":f": false,
        ":u": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    }));
    return res.Attributes as ChatSessionRow;
  },

  async updateTitle(userId: string, id: string, title: string): Promise<ChatSessionRow | null> {
    try {
      const res = await ddb.get().send(new UpdateCommand({
        TableName: tables.chatSessions(),
        Key: { user_id: userId, id },
        UpdateExpression: "SET #t = :t, updated_at = :u",
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeNames: { "#t": "title" },
        ExpressionAttributeValues: {
          ":t": title,
          ":u": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      }));
      return (res.Attributes as ChatSessionRow | undefined) ?? null;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return null;
      throw err;
    }
  },

  async deleteForUser(userId: string, id: string): Promise<ChatSessionRow | null> {
    const res = await ddb.get().send(new DeleteCommand({
      TableName: tables.chatSessions(),
      Key: { user_id: userId, id },
      ReturnValues: "ALL_OLD",
    }));
    return (res.Attributes as ChatSessionRow | undefined) ?? null;
  },

  async listMessagesAsc(sessionId: string): Promise<ChatSessionMessageRow[]> {
    const rows: ChatSessionMessageRow[] = [];
    let lastKey: DdbKey | undefined;
    do {
      const res = await ddb.get().send(new QueryCommand({
        TableName: tables.chatMessages(),
        KeyConditionExpression: "session_id = :s",
        ExpressionAttributeValues: { ":s": sessionId },
        ExclusiveStartKey: lastKey,
        // PK=session_id, SK=created_at_id — SK is ISO-prefixed so natural
        // ascending scan order is chronological.
        ScanIndexForward: true,
      }));
      rows.push(...((res.Items ?? []) as ChatSessionMessageRow[]));
      lastKey = res.LastEvaluatedKey as DdbKey | undefined;
    } while (lastKey);
    return rows;
  },

  async listMessageDataAsc(
    sessionId: string,
  ): Promise<Pick<ChatSessionMessageRow, "data">[]> {
    const rows = await this.listMessagesAsc(sessionId);
    return rows.map((r) => ({ data: r.data }));
  },

  async insertMessage(
    sessionId: string,
    data: ChatSessionMessageData,
  ): Promise<ChatSessionMessageRow> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const row: ChatSessionMessageRow = {
      session_id: sessionId,
      id,
      created_at_id: `${now}#${id}`,
      data,
      created_at: now,
    };
    await ddb.get().send(new PutCommand({
      TableName: tables.chatMessages(),
      Item: row,
    }));
    return row;
  },
};
