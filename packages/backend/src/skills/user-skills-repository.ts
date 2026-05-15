import { randomUUID } from "node:crypto";

import { type DdbTable, ddbTables } from "../lib/ddb.js";
import type { UserSkillRow } from "../types/database.js";
import type { InstallableSkillConfig, InstallableSkillId } from "./index.js";
import { taggedConfig } from "./index.js";

class UserSkillsRepository {
  constructor(private readonly table: DdbTable<UserSkillRow, { user_id: string; id: string }>) {}

  async listForUser(userId: string): Promise<UserSkillRow[]> {
    const rows = await this.table.queryByPartitionKey("user_id", userId);
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return rows;
  }

  /** Low-volume demo — swap for a GSI lookup or per-user fanout when cardinality matters. */
  scanAll(): Promise<UserSkillRow[]> {
    return this.table.scanAll();
  }

  async getByIdForUser(userId: string, id: string): Promise<UserSkillRow | null> {
    return this.table.get({ user_id: userId, id });
  }

  /**
   * Upsert by (user_id, skill_id). Reconnecting the same provider for the
   * same user updates the existing row in place (new tokens overwrite old)
   * instead of leaving a stale row alongside the new one.
   */
  async upsert(opts: {
    userId: string;
    skillId: InstallableSkillId;
    config: InstallableSkillConfig["config"];
  }): Promise<UserSkillRow> {
    const all = await this.table.queryByPartitionKey("user_id", opts.userId);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- single installable variant today; comparison becomes meaningful on a 2nd skill
    const existing = all.find((r) => r.data.skill_id === opts.skillId) ?? null;
    const now = new Date().toISOString();
    const row: UserSkillRow = {
      user_id: opts.userId,
      id: existing?.id ?? randomUUID(),
      data: taggedConfig(opts.skillId, opts.config),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    await this.table.put(row);
    return row;
  }

  updateData(
    userId: string,
    id: string,
    data: InstallableSkillConfig,
  ): Promise<UserSkillRow | null> {
    return this.table.updateIf({
      key: { user_id: userId, id },
      updateExpression: "SET #d = :d, updated_at = :u",
      conditionExpression: "attribute_exists(id)",
      expressionAttributeNames: { "#d": "data" },
      expressionAttributeValues: { ":d": data, ":u": new Date().toISOString() },
    });
  }

  deleteForUser(userId: string, id: string): Promise<UserSkillRow | null> {
    return this.table.delete({ user_id: userId, id });
  }
}

export const userSkillsRepo = new UserSkillsRepository(ddbTables.userSkills);
