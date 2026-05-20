import { randomUUID } from "node:crypto";

import { type DdbTable, ddbTables } from "../lib/ddb.js";
import type { UserRow } from "../types/database.js";

const STARTING_CREDITS = 100;

class UsersRepository {
  constructor(private readonly table: DdbTable<UserRow, { id: string }>) {}

  async getById(id: string): Promise<UserRow | null> {
    return this.table.get({ id });
  }

  async create(input: { name: string }): Promise<UserRow> {
    const now = new Date().toISOString();
    const row: UserRow = {
      id: randomUUID(),
      name: input.name,
      credits: STARTING_CREDITS,
      created_at: now,
      updated_at: now,
    };
    await this.table.put(row, { conditionExpression: "attribute_not_exists(id)" });
    return row;
  }
}

export const usersRepo = new UsersRepository(ddbTables.users);
