import { type DdbTable, ddbTables } from "../lib/ddb.js";
import type { SessionRow } from "../types/database.js";

class SessionsRepository {
  constructor(private readonly table: DdbTable<SessionRow, { id: string }>) {}

  async get(id: string): Promise<SessionRow | null> {
    return this.table.get({ id });
  }

  async create(input: { id: string; userId: string; expiresAt: Date }): Promise<SessionRow> {
    const row: SessionRow = {
      id: input.id,
      user_id: input.userId,
      expires_at: input.expiresAt.toISOString(),
      expires_at_epoch: Math.floor(input.expiresAt.getTime() / 1000),
      created_at: new Date().toISOString(),
    };
    await this.table.put(row);
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.table.delete({ id });
  }
}

export const sessionsRepo = new SessionsRepository(ddbTables.sessions);
