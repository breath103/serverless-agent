import { type DdbTable, ddbTables } from "../lib/ddb.js";
import type { ProfileRow } from "../types/database.js";

class ProfilesRepository {
  constructor(private readonly table: DdbTable<ProfileRow, { user_id: string }>) {}

  async getByUserId(userId: string): Promise<ProfileRow | null> {
    return this.table.get({ user_id: userId });
  }

  async create(userId: string, input: { name: string }): Promise<ProfileRow> {
    const now = new Date().toISOString();
    const row: ProfileRow = {
      user_id: userId,
      name: input.name,
      language: "en-US",
      timezone: "Etc/UTC",
      about: "",
      debug: null,
      created_at: now,
      updated_at: now,
    };
    await this.table.put(row);
    return row;
  }

  update(
    userId: string,
    patch: { name: string; language: string; timezone: string; about: string },
  ): Promise<ProfileRow> {
    return this.table.update({
      key: { user_id: userId },
      updateExpression: "SET #n = :n, #l = :l, #tz = :tz, #a = :a, #u = :u",
      expressionAttributeNames: {
        "#n": "name",
        "#l": "language",
        "#tz": "timezone",
        "#a": "about",
        "#u": "updated_at",
      },
      expressionAttributeValues: {
        ":n": patch.name,
        ":l": patch.language,
        ":tz": patch.timezone,
        ":a": patch.about,
        ":u": new Date().toISOString(),
      },
    });
  }
}

export const profilesRepo = new ProfilesRepository(ddbTables.profiles);
