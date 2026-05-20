import { type DdbTable, ddbTables } from "../lib/ddb.js";
import type { AccountRow } from "../types/database.js";

class AccountsRepository {
  constructor(private readonly table: DdbTable<AccountRow, { user_id: string; provider: string }>) {}

  async findByProviderSub(input: { provider: AccountRow["provider"]; sub: string }): Promise<AccountRow | null> {
    return this.table.queryFirst({
      indexName: "by-provider-sub",
      keyConditionExpression: "#p = :p AND #s = :s",
      expressionAttributeNames: { "#p": "provider", "#s": "sub" },
      expressionAttributeValues: { ":p": input.provider, ":s": input.sub },
    });
  }

  async listForUser(userId: string): Promise<AccountRow[]> {
    return this.table.queryByPartitionKey("user_id", userId);
  }

  async create(input: {
    userId: string;
    provider: AccountRow["provider"];
    sub: string;
    email: string;
    emailVerified: boolean;
  }): Promise<AccountRow> {
    const now = new Date().toISOString();
    const row: AccountRow = {
      user_id: input.userId,
      provider: input.provider,
      sub: input.sub,
      email: input.email,
      email_verified: input.emailVerified,
      created_at: now,
      updated_at: now,
    };
    await this.table.put(row);
    return row;
  }
}

export const accountsRepo = new AccountsRepository(ddbTables.accounts);
