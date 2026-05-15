import { randomUUID } from "node:crypto";

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

import { ddb, tables } from "../lib/ddb.js";
import type { UserSkillRow } from "../types/database.js";
import type { InstallableSkillConfig, InstallableSkillId } from "./index.js";

type DdbKey = Record<string, string>;

async function queryAllForUser(userId: string): Promise<UserSkillRow[]> {
  const rows: UserSkillRow[] = [];
  let lastKey: DdbKey | undefined;
  do {
    const res = await ddb.get().send(new QueryCommand({
      TableName: tables.userSkills(),
      KeyConditionExpression: "user_id = :u",
      ExpressionAttributeValues: { ":u": userId },
      ExclusiveStartKey: lastKey,
    }));
    rows.push(...((res.Items ?? []) as UserSkillRow[]));
    lastKey = res.LastEvaluatedKey as DdbKey | undefined;
  } while (lastKey);
  return rows;
}

export const userSkillsRepo = {
  async listForUser(userId: string): Promise<UserSkillRow[]> {
    const rows = await queryAllForUser(userId);
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return rows;
  },

  /**
   * Scan the whole user_skills table. Used by the background-refresh worker
   * (cron) to iterate every row across users. Low-volume demo — replace with
   * a GSI lookup or a per-user fanout when cardinality matters.
   */
  async scanAll(): Promise<UserSkillRow[]> {
    const rows: UserSkillRow[] = [];
    let lastKey: DdbKey | undefined;
    do {
      const res = await ddb.get().send(new ScanCommand({
        TableName: tables.userSkills(),
        ExclusiveStartKey: lastKey,
      }));
      rows.push(...((res.Items ?? []) as UserSkillRow[]));
      lastKey = res.LastEvaluatedKey as DdbKey | undefined;
    } while (lastKey);
    return rows;
  },

  async getByIdForUser(userId: string, id: string): Promise<UserSkillRow | null> {
    const res = await ddb.get().send(new GetCommand({
      TableName: tables.userSkills(),
      Key: { user_id: userId, id },
    }));
    return (res.Item as UserSkillRow | undefined) ?? null;
  },

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
    const all = await queryAllForUser(opts.userId);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- single installable variant today; comparison becomes meaningful on a 2nd skill
    const existing = all.find((r) => r.data.skill_id === opts.skillId) ?? null;
    const now = new Date().toISOString();
    const row: UserSkillRow = {
      user_id: opts.userId,
      id: existing?.id ?? randomUUID(),
      data: { skill_id: opts.skillId, config: opts.config } as InstallableSkillConfig,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    await ddb.get().send(new PutCommand({
      TableName: tables.userSkills(),
      Item: row,
    }));
    return row;
  },

  async updateData(
    userId: string,
    id: string,
    data: InstallableSkillConfig,
  ): Promise<UserSkillRow | null> {
    const existing = await this.getByIdForUser(userId, id);
    if (!existing) return null;
    const updated: UserSkillRow = {
      ...existing,
      data,
      updated_at: new Date().toISOString(),
    };
    await ddb.get().send(new PutCommand({
      TableName: tables.userSkills(),
      Item: updated,
    }));
    return updated;
  },

  async deleteForUser(userId: string, id: string): Promise<UserSkillRow | null> {
    const res = await ddb.get().send(new DeleteCommand({
      TableName: tables.userSkills(),
      Key: { user_id: userId, id },
      ReturnValues: "ALL_OLD",
    }));
    return (res.Attributes as UserSkillRow | undefined) ?? null;
  },
};
