# Repos as Classes with Shared DDB Accessor — Design

**Status:** proposed
**Issue:** [#3 — refactor(backend): turn repos into classes with shared DDB accessor](https://github.com/breath103/serverless-agent/issues/3)
**Date:** 2026-05-15

---

## Problem

Today every backend repo is an object literal that re-implements the same DynamoDB plumbing. Six repos, mostly the same shape:

```ts
// memories-repository.ts (excerpt)
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
  async getById(userId: string, id: string): Promise<Memory | null> {
    const res = await ddb.get().send(new GetCommand({
      TableName: tables.memories(),
      Key: { user_id: userId, id },
    }));
    return (res.Item as Memory | undefined) ?? null;
  },
  ...
};
```

The same `queryAllForUser` pagination loop appears verbatim in `memories-repository.ts`, `chat-sessions-repository.ts`, and `user-skills-repository.ts`. Every read does the `(res.Item as TRow | undefined) ?? null` cast. Every write builds `new PutCommand({ TableName: tables.X(), Item: row })`. The repo file is mostly boilerplate.

There's also no dependency injection — `ddb` and `tables` are imported at module top, so the repo can never be tested with a fake table and can never be re-targeted at, say, a different DDB endpoint without rewriting the module.

## Goal

1. Each repo becomes a **class**.
2. The class takes a shared **DDB accessor** in its constructor.
3. Repo files get **shorter** because the duplicated DDB code moves into the accessor.

## Approach

### Layer 1: `DdbTable<TRow, TKey>` — the shared accessor

A typed table handle, one instance per entity. Holds the `DynamoDBDocumentClient` and the entity name (lazy resolution of `${TABLE_NAME_PREFIX}-<entity>` so we don't read env at module-load time):

```ts
export class DdbTable<TRow, TKey extends Record<string, string>> {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly entity: string,
  ) {}

  private get tableName(): string {
    return `${process.env.TABLE_NAME_PREFIX}-${this.entity}`;
  }

  async get(key: TKey): Promise<TRow | null> { ... }
  async put(item: TRow, opts?: { conditionExpression?: string }): Promise<void> { ... }
  async update(opts: UpdateOpts<TKey>): Promise<TRow | null> { ... }
  async delete(key: TKey): Promise<TRow | null> { ... }
  async queryAll(opts: QueryOpts): Promise<TRow[]> { ... }
  async scanAll(): Promise<TRow[]> { ... }
}
```

`queryAll` swallows the pagination loop. `delete` defaults to `ReturnValues: "ALL_OLD"` and casts. `update` wraps `UpdateCommand` and returns `Attributes` cast to `TRow | null`, swallowing `ConditionalCheckFailedException` into `null` (matches the existing `beginGenerating` / `updateTitle` pattern in `chat-sessions-repository.ts`).

### Layer 2: One typed table instance per entity

Exported from `lib/ddb.ts`:

```ts
const client = ddbDocClient(); // existing singleton, renamed for clarity
export const ddbTables = {
  users:        new DdbTable<UserRow,             { id: string }>(client, "users"),
  sessions:     new DdbTable<SessionRow,          { id: string }>(client, "sessions"),
  profiles:     new DdbTable<ProfileRow,          { user_id: string }>(client, "profiles"),
  memories:     new DdbTable<Memory,              { user_id: string; id: string }>(client, "memories"),
  chatSessions: new DdbTable<ChatSessionRow,      { user_id: string; id: string }>(client, "chat-sessions"),
  chatMessages: new DdbTable<ChatSessionMessageRow, { session_id: string; created_at_id: string }>(client, "chat-messages"),
  userSkills:   new DdbTable<UserSkillRow,        { user_id: string; id: string }>(client, "user-skills"),
};
```

The `tables` plain-string-function export goes away — `ddbTables.X` is the typed replacement. Scripts that need a raw table name (`e2e_skill.ts`) get the underlying client + entity from the table instance, or just keep using a `tableName` getter on `DdbTable`.

### Layer 3: Repos as classes, constructor-injected

```ts
// memories-repository.ts
export class MemoriesRepository {
  constructor(
    private readonly table: DdbTable<Memory, { user_id: string; id: string }>,
  ) {}

  async list(userId: string, opts?: { limit?: number; before?: string }): Promise<Memory[]> {
    const limit = Math.min(opts?.limit ?? 50, 100);
    const all = await this.table.queryAll({
      keyConditionExpression: "user_id = :u",
      expressionAttributeValues: { ":u": userId },
    });
    const filtered = opts?.before ? all.filter((r) => r.created_at < opts.before!) : all;
    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return filtered.slice(0, limit);
  }

  async getById(userId: string, id: string): Promise<Memory | null> {
    return this.table.get({ user_id: userId, id });
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

  async delete(userId: string, id: string): Promise<Memory | null> {
    return this.table.delete({ user_id: userId, id });
  }

  // ... etc
}

export const memoriesRepo = new MemoriesRepository(ddbTables.memories);
```

Singleton instance is exported with the existing name — callers don't change.

**`ChatSessionsRepository`** takes two tables (chatSessions + chatMessages) since one repo owns both:

```ts
export class ChatSessionsRepository {
  constructor(
    private readonly sessions: DdbTable<ChatSessionRow,        { user_id: string; id: string }>,
    private readonly messages: DdbTable<ChatSessionMessageRow, { session_id: string; created_at_id: string }>,
  ) {}
  ...
}
export const chatSessionsRepo = new ChatSessionsRepository(ddbTables.chatSessions, ddbTables.chatMessages);
```

### Why classes (vs. factory function returning an object)?

A `class` is what the user asked for, but it's also the right shape: stateful (holds the table reference), instance methods naturally reference `this.table`, and TypeScript surfaces `private readonly table` more clearly than a closure. The `extends`/`implements` slot opens for future shared base behavior (e.g. a `UserScopedRepository` base with `listForUser`) if and when a second repo wants the same shape.

## Expected LOC delta

Rough counts of *signal* lines (no `import` lines, no `}` lines). Today vs. after:

| File | Today | After | Δ |
|---|---|---|---|
| `lib/ddb.ts` | ~25 | ~80 (DdbTable class + typed instances) | +55 |
| `users-repository.ts` | ~35 | ~22 | −13 |
| `sessions-repository.ts` | ~28 | ~14 | −14 |
| `profiles-repository.ts` | ~45 | ~38 (update keeps its UpdateCommand) | −7 |
| `memories-repository.ts` | ~95 | ~55 (no queryAllForUser) | −40 |
| `chat-sessions-repository.ts` | ~160 | ~120 (no queryAllSessionsForUser, no listMessagesAsc loop) | −40 |
| `user-skills-repository.ts` | ~95 | ~60 (no queryAllForUser, no scanAll loop) | −35 |
| **Total** | **~483** | **~389** | **−94** |

Net repo+accessor LOC down ~20%. The shared accessor pays for itself at the 2nd repo.

## Risks / non-goals

- **Singleton-via-instance.** Today `ddb.get()` is a deferred singleton — the `DynamoDBClient` is only constructed on first use. The class-based version constructs the client at module load when `lib/ddb.ts` is first imported. This is fine for Lambda (cold start anyway) and for dev scripts (which start the DDB-local container before importing repos). No deferred-init needed.
- **`tableName` getter reads env on every call.** Fine — env reads are cheap, and we already read `process.env.TABLE_NAME_PREFIX` on every call today via `tables.X()`. No change in behavior.
- **`e2e_skill.ts` imports `ddb`/`tables` directly.** It seeds a row past the repo to test `scanAll` over an expired token. Migrate it to use `ddbTables.userSkills.put(...)` so it doesn't depend on the `tables` export. Same blast radius, less surface.
- **Out of scope:** splitting `chatSessionsRepo` into chatSessions vs chatMessages, replacing `userSkillsRepo.upsert`'s in-memory dedup with a GSI, replacing `memoriesRepo.search` substring scan with a real index.

## Acceptance

- All 6 repos are classes constructed with their `DdbTable` instance(s).
- `queryAllForUser` and `queryAllSessionsForUser` helpers are gone — paginated query lives on `DdbTable.queryAll`.
- All existing call sites work unchanged (same exported singleton name, same method signatures).
- `e2e_skill.ts` passes locally.
- Type-check + lint clean.
- Local dev: sign in, send a chat with a memory tool call, install/uninstall a skill — same UX.

## Implementation order

1. Add `DdbTable` + typed `ddbTables` registry to `lib/ddb.ts`. Keep the `tables` export temporarily to keep the tree green.
2. Convert `users` + `sessions` (smallest, no pagination).
3. Convert `profiles` (no pagination, has Update).
4. Convert `memories` (pagination + search).
5. Convert `chatSessions` (pagination, conditional update, two tables).
6. Convert `userSkills` (pagination + scan).
7. Migrate `e2e_skill.ts` to `ddbTables.userSkills`.
8. Delete the `tables` re-export.
9. Build + lint + e2e.
