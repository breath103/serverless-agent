import { randomUUID } from "node:crypto";

import { type DdbTable, ddbTables } from "../lib/ddb.js";
import type { ChatSessionMessageData } from "../lib/realtime-events.js";
import type { ChatSessionKind, ChatSessionMessageRow, ChatSessionRow } from "../types/database.js";

class ChatSessionsRepository {
  constructor(
    private readonly sessions: DdbTable<ChatSessionRow, { user_id: string; id: string }>,
    private readonly messages: DdbTable<ChatSessionMessageRow, { session_id: string; created_at_id: string }>,
  ) {}

  async listForUser(userId: string): Promise<ChatSessionRow[]> {
    const rows = await this.sessions.queryByPartitionKey("user_id", userId);
    rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return rows;
  }

  async getByIdForUser(userId: string, id: string): Promise<ChatSessionRow | null> {
    return this.sessions.get({ user_id: userId, id });
  }

  async existsForUser(userId: string, id: string): Promise<boolean> {
    return (await this.getByIdForUser(userId, id)) !== null;
  }

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
    await this.sessions.put(row);
    return row;
  }

  /**
   * Atomically flip is_generating false → true for a session owned by
   * this user. Returns the row on success, null if already generating.
   */
  beginGenerating(userId: string, id: string): Promise<ChatSessionRow | null> {
    return this.sessions.updateIf({
      key: { user_id: userId, id },
      updateExpression: "SET is_generating = :t, updated_at = :u",
      conditionExpression: "attribute_exists(id) AND is_generating = :f",
      expressionAttributeValues: {
        ":t": true,
        ":f": false,
        ":u": new Date().toISOString(),
      },
    });
  }

  endGenerating(userId: string, id: string): Promise<ChatSessionRow> {
    return this.sessions.update({
      key: { user_id: userId, id },
      updateExpression: "SET is_generating = :f, updated_at = :u",
      expressionAttributeValues: {
        ":f": false,
        ":u": new Date().toISOString(),
      },
    });
  }

  updateTitle(userId: string, id: string, title: string): Promise<ChatSessionRow | null> {
    return this.sessions.updateIf({
      key: { user_id: userId, id },
      updateExpression: "SET #t = :t, updated_at = :u",
      conditionExpression: "attribute_exists(id)",
      expressionAttributeNames: { "#t": "title" },
      expressionAttributeValues: {
        ":t": title,
        ":u": new Date().toISOString(),
      },
    });
  }

  deleteForUser(userId: string, id: string): Promise<ChatSessionRow | null> {
    return this.sessions.delete({ user_id: userId, id });
  }

  listMessagesAsc(sessionId: string): Promise<ChatSessionMessageRow[]> {
    // SK `created_at_id` is ISO-prefixed → default ascending Query order is chronological.
    return this.messages.queryByPartitionKey("session_id", sessionId);
  }

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
    await this.messages.put(row);
    return row;
  }
}

export const chatSessionsRepo = new ChatSessionsRepository(
  ddbTables.chatSessions,
  ddbTables.chatMessages,
);
