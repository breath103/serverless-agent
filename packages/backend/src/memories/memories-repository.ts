import { randomUUID } from "node:crypto";

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import { ddb, tables } from "../lib/ddb.js";
import { markdownToText } from "../lib/markdown-to-text.js";
import type {
  Memory,
  MemoryPatch,
  MemorySearchMatch,
  MemoryWriteInput,
} from "../types/memories.js";

type DdbKey = Record<string, string>;

async function queryAllForUser(userId: string): Promise<Memory[]> {
  const rows: Memory[] = [];
  let lastKey: DdbKey | undefined;
  do {
    const res = await ddb.get().send(new QueryCommand({
      TableName: tables.memories(),
      KeyConditionExpression: "user_id = :u",
      ExpressionAttributeValues: { ":u": userId },
      ExclusiveStartKey: lastKey,
    }));
    rows.push(...((res.Items ?? []) as Memory[]));
    lastKey = res.LastEvaluatedKey as DdbKey | undefined;
  } while (lastKey);
  return rows;
}

export const memoriesRepo = {
  async list(userId: string, opts?: { limit?: number; before?: string }): Promise<Memory[]> {
    const limit = Math.min(opts?.limit ?? 50, 100);
    const all = await queryAllForUser(userId);
    const filtered = opts?.before ? all.filter((r) => r.created_at < opts.before!) : all;
    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return filtered.slice(0, limit);
  },

  async getById(userId: string, id: string): Promise<Memory | null> {
    const res = await ddb.get().send(new GetCommand({
      TableName: tables.memories(),
      Key: { user_id: userId, id },
    }));
    return (res.Item as Memory | undefined) ?? null;
  },

  async getByIds(userId: string, ids: string[]): Promise<Memory[]> {
    if (ids.length === 0) return [];
    const idSet = new Set(ids);
    const all = await queryAllForUser(userId);
    return all.filter((r) => idSet.has(r.id));
  },

  async create(userId: string, input: MemoryWriteInput): Promise<Memory> {
    const now = new Date().toISOString();
    const row: Memory = {
      user_id: userId,
      id: randomUUID(),
      title: input.title,
      content: input.content,
      created_at: now,
      updated_at: now,
    };
    await ddb.get().send(new PutCommand({
      TableName: tables.memories(),
      Item: row,
    }));
    return row;
  },

  async update(userId: string, id: string, patch: MemoryPatch): Promise<Memory | null> {
    const existing = await this.getById(userId, id);
    if (!existing) return null;
    const updated: Memory = {
      ...existing,
      title: patch.title ?? existing.title,
      content: patch.content ?? existing.content,
      updated_at: new Date().toISOString(),
    };
    await ddb.get().send(new PutCommand({
      TableName: tables.memories(),
      Item: updated,
    }));
    return updated;
  },

  async delete(userId: string, id: string): Promise<Memory | null> {
    const res = await ddb.get().send(new DeleteCommand({
      TableName: tables.memories(),
      Key: { user_id: userId, id },
      ReturnValues: "ALL_OLD",
    }));
    return (res.Attributes as Memory | undefined) ?? null;
  },

  async search(userId: string, query: string, limit = 50): Promise<MemorySearchMatch[]> {
    const cappedLimit = Math.min(limit, 100);
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const all = await queryAllForUser(userId);
    const matches: MemorySearchMatch[] = [];
    for (const r of all) {
      const haystack = `${r.title}\n${markdownToText(r.content)}`.toLowerCase();
      if (haystack.includes(needle)) {
        matches.push({ id: r.id, title: r.title, rank: 1 });
      }
      if (matches.length >= cappedLimit) break;
    }
    return matches;
  },
};
