import { randomUUID } from "node:crypto";

import { type DdbTable, ddbTables } from "../lib/ddb.js";
import type { UserRow } from "../types/database.js";

class UsersRepository {
  constructor(private readonly table: DdbTable<UserRow, { id: string }>) {}

  async getById(id: string): Promise<UserRow | null> {
    return this.table.get({ id });
  }

  async getByUsername(username: string): Promise<UserRow | null> {
    return this.table.queryFirst({
      indexName: "by-username",
      keyConditionExpression: "username = :u",
      expressionAttributeValues: { ":u": username },
    });
  }

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
    // Cheap guard against ID collisions — randomUUID has enough entropy
    // that this should never trigger.
    await this.table.put(row, { conditionExpression: "attribute_not_exists(id)" });
    return row;
  }
}

export const usersRepo = new UsersRepository(ddbTables.users);
