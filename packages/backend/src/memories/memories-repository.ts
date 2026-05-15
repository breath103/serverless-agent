import { randomUUID } from "node:crypto";

import { type DdbTable, ddbTables } from "../lib/ddb.js";
import { markdownToText } from "../lib/markdown-to-text.js";
import type {
  Memory,
  MemoryPatch,
  MemorySearchMatch,
  MemoryWriteInput,
} from "../types/memories.js";

class MemoriesRepository {
  constructor(private readonly table: DdbTable<Memory, { user_id: string; id: string }>) {}

  async list(userId: string, opts?: { limit?: number; before?: string }): Promise<Memory[]> {
    const limit = Math.min(opts?.limit ?? 50, 100);
    const all = await this.table.queryByPartitionKey("user_id", userId);
    const filtered = opts?.before ? all.filter((r) => r.created_at < opts.before!) : all;
    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return filtered.slice(0, limit);
  }

  async getById(userId: string, id: string): Promise<Memory | null> {
    return this.table.get({ user_id: userId, id });
  }

  async getByIds(userId: string, ids: string[]): Promise<Memory[]> {
    if (ids.length === 0) return [];
    const idSet = new Set(ids);
    const all = await this.table.queryByPartitionKey("user_id", userId);
    return all.filter((r) => idSet.has(r.id));
  }

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
    await this.table.put(row);
    return row;
  }

  async update(userId: string, id: string, patch: MemoryPatch): Promise<Memory | null> {
    const existing = await this.getById(userId, id);
    if (!existing) return null;
    const updated: Memory = {
      ...existing,
      title: patch.title ?? existing.title,
      content: patch.content ?? existing.content,
      updated_at: new Date().toISOString(),
    };
    await this.table.put(updated);
    return updated;
  }

  async delete(userId: string, id: string): Promise<Memory | null> {
    return this.table.delete({ user_id: userId, id });
  }

  async search(userId: string, query: string, limit = 50): Promise<MemorySearchMatch[]> {
    const cappedLimit = Math.min(limit, 100);
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const all = await this.table.queryByPartitionKey("user_id", userId);
    const matches: MemorySearchMatch[] = [];
    for (const r of all) {
      const haystack = `${r.title}\n${markdownToText(r.content)}`.toLowerCase();
      if (haystack.includes(needle)) {
        matches.push({ id: r.id, title: r.title, rank: 1 });
      }
      if (matches.length >= cappedLimit) break;
    }
    return matches;
  }
}

export const memoriesRepo = new MemoriesRepository(ddbTables.memories);
