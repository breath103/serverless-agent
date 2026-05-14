# Backend Coding Guidelines

---

## Declare env vars in env.d.ts

Never use `process.env.FOO!`. Declare variables in `src/env.d.ts`.

```typescript
// ✅ Correct - declare in env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    MY_VAR: string;
    OPTIONAL_VAR?: string;
  }
}

// Then use without assertion
const value = process.env.MY_VAR;
```

```typescript
// ❌ Wrong
const value = process.env.MY_VAR!;
```

---

## Verify library config options by checking types

Never guess option placement. Check `.d.ts` files or use "Go to Definition".

```typescript
// ✅ Correct - verified in types
export const auth = betterAuth({
  advanced: {
    trustedProxyHeaders: true,
  },
});
```

```typescript
// ❌ Wrong - guessed placement
export const auth = betterAuth({
  trustedProxyHeaders: true,  // Not a top-level option
});
```

---

## Use loadConfig() for configuration (scripts only)

In scripts (e.g., `scripts/dev.ts`, `scripts/deploy.ts`, `scripts/build.ts`), use `loadConfig()` to read `tss.json`:

```typescript
import { loadConfig } from "shared/config";
const config = loadConfig();
```

This does NOT apply to runtime code (`src/`) which runs in Lambda and may not have access to `tss.json`.

---

## Use typed error classes when available

When catching errors, use `instanceof` with typed error classes instead of duck typing `error.name` or `error.code`.

```typescript
// ✅ Correct - use typed error class
import { ParameterNotFound } from "@aws-sdk/client-ssm";

try {
  await client.send(new GetParameterCommand({ Name: path }));
} catch (error) {
  if (error instanceof ParameterNotFound) {
    console.log("Parameter not found");
  } else {
    throw error;
  }
}
```

```typescript
// ❌ Wrong - duck typing error.name
try {
  await client.send(new GetParameterCommand({ Name: path }));
} catch (error) {
  if (error instanceof Error && error.name === "ParameterNotFound") {
    console.log("Parameter not found");
  }
}
```

---

## Use HTTPException for known error status codes

Always throw `HTTPException` with the correct status code. Never throw plain `Error` and rely on the error handler to guess the status. Plain `Error` throws become 500.

Use `c.get("requireUser")()` for auth checks instead of manually checking `c.get("user")`.

```typescript
// ✅ Correct
import { HTTPException } from "hono/http-exception";

const user = c.get("requireUser")();

if (!agent) throw new HTTPException(404, { message: "Not found" });
if (!handler.writable) throw new HTTPException(400, { message: "Channel is not writable" });
```

```typescript
// ❌ Wrong — becomes 500, no status code info
const user = c.get("user");
if (!user) throw new Error("Unauthorized");

if (!agent) throw new Error("Not found");
```

---

## Use Database row types — no manual interfaces

Use `Database["public"]["Tables"]["table_name"]["Row"]` for types. Never create manual interfaces for database rows.

```typescript
// ✅ Correct - use generated types
import type { Database } from "@backend/types/database";
type Channel = Database["public"]["Tables"]["channels"]["Row"];
```

```typescript
// ❌ Wrong - manual interface duplicating DB schema
interface Channel {
  id: string;
  type: string;
  created_at: string;
}
```

---

## When two columns are correlated, merge them into one jsonb

Supabase's `OverrideProps` / `OverrideTableColumns` in `types/database.ts`
merges column-by-column. A Row type like
`{ role: "user"; content: UserText } | { role: "assistant"; content: AssistantContent }`
gets flattened — TypeScript loses the correlation and `role` and
`content` become independent fields typed with their full unions. Inserting
a mismatched pair (`role: "user"` + tool_call content) type-checks.

When columns are semantically correlated, store them together in a single
`jsonb` column typed as a discriminated union. The override sees one column,
the union survives end-to-end.

```sql
-- ✅ Correct — single jsonb column, correlation preserved
create table chat_session_messages (
  id uuid primary key,
  session_id uuid references chat_sessions(id),
  data jsonb not null  -- { role, content } discriminated union
);
```

```typescript
// ✅ Correct — one column, one union, TS tracks role ↔ content
type ChatSessionMessageData =
  | { role: "user"; content: { kind: "text"; text: string } }
  | { role: "assistant"; content: AssistantMessageContent };

chat_session_messages: {
  Row: { data: ChatSessionMessageData };
  ...
};
```

```sql
-- ❌ Wrong — two columns, correlation lost at TS type level
create table chat_session_messages (
  role text not null,
  content jsonb not null
);
```

---

## Extract error messages with `instanceof Error`, not `as Error`

Never cast caught errors with `as Error` just to reach `.message`. The
caught value's type is `unknown` for good reasons. Use `instanceof` narrowing
(matches `telemetry.ts` convention).

```typescript
// ✅ Correct
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  throw new HTTPException(500, { message });
}
```

```typescript
// ❌ Wrong — as-cast hides the case where err is a string, object, etc.
} catch (err) {
  throw new HTTPException(500, { message: (err as Error).message });
}
```

---

## Return Supabase rows directly — no mapping functions

Never create `rowToX()` mapping functions. Return Supabase rows directly (snake_case). Override jsonb/enum fields via `ApplyTableOverrides` in `types/database.ts`.

```typescript
// ✅ Correct - return rows directly
const { data } = await supabase.from("channels").select("*");
return data;
```

```typescript
// ❌ Wrong - unnecessary mapping
function rowToChannel(row: ChannelRow): Channel {
  return { id: row.id, channelType: row.channel_type };
}
const { data } = await supabase.from("channels").select("*");
return data.map(rowToChannel);
```

---

## Wrap in options object when more than 3 parameters

Functions with more than 3 parameters must use an options object.

```typescript
// ✅ Correct - options object
interface RunTurnOptions {
  api: PensieveApi;
  llm: LlmProvider;
  logger: AgentLogger;
  history: LlmMessage[];
  events: AgentChannelMessage[];
}

async function runTurn(opts: RunTurnOptions): Promise<void> {
  const { api, llm, logger, history, events } = opts;
}
```

```typescript
// ❌ Wrong - too many positional parameters
async function runTurn(
  api: PensieveApi,
  llm: LlmProvider,
  logger: AgentLogger,
  history: LlmMessage[],
  events: AgentChannelMessage[],
): Promise<void> {}
```

---

## Prefer discriminated unions over optional fields

Use discriminated unions (tagged unions) instead of optional fields when values are mutually exclusive. This gives exhaustive type checking and avoids impossible states.

```typescript
// ✅ Correct - discriminated union, no impossible states
type ToolResult =
  | { type: "success"; output: string }
  | { type: "error"; output: string; error: string };

type TurnLog =
  | { type: "turn_end"; steps: number }
  | { type: "turn_error"; steps: number; error: string };
```

```typescript
// ❌ Wrong - optional fields allow impossible states
type ToolResult = {
  success: boolean;
  output: string;
  error?: string;  // can exist when success=true — meaningless
};

type TurnLog = {
  type: "turn_end";
  steps: number;
  error?: string;  // optional instead of a separate variant
};
```

---

## Always use switch for discriminated unions

When handling a discriminated union, always use a `switch` statement on the discriminant. Never use `if`/`else if` chains. This ensures exhaustive handling — the compiler will catch missing cases.

```typescript
// ✅ Correct - switch on discriminant, exhaustive
switch (result.status) {
  case "installed": break;
  case "authentication": window.location.href = result.url; break;
}
```

```typescript
// ❌ Wrong - if/else loses exhaustiveness checking
if (result.status === "authentication") {
  window.location.href = result.url;
}
```

---

## No warnings — treat ESLint warnings as errors

ESLint warnings must be fixed, not ignored. A clean lint run means zero errors AND zero warnings.

```typescript
// ✅ Correct - return Promise directly instead of async with no await
function listChannels(): Promise<Channel[]> {
  return api.fetch("/api/channels", "GET");
}
```

```typescript
// ❌ Wrong - async with no await triggers require-await warning
async function listChannels(): Promise<Channel[]> {
  return api.fetch("/api/channels", "GET");
}
```

---

## Never force-cast API client responses

`ApiClient.fetch()` returns fully typed responses. If you're using `as unknown as` to cast the result, you're hiding a type mismatch — fix the type, don't cast it away.

```typescript
// ✅ Correct - use the return type directly
function listChannels() {
  return api.fetch("/api/channels", "GET");
}
```

```typescript
// ❌ Wrong - force casting hides a real type mismatch
function listChannels(): Promise<Channel[]> {
  return api.fetch("/api/channels", "GET") as unknown as Promise<Channel[]>;
}
```

---

## Avoid `unknown` and `as` casts — use generics and inline construction

`unknown` is banned by ESLint. Instead of returning `unknown` and casting the result, make the function generic so callers specify the type at the call site.

```typescript
// ✅ Correct - generic return type, caller specifies T
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  return res.json() as Promise<T>;
}
const data = await apiFetch<{ items: Event[] }>("/events");
```

```typescript
// ❌ Wrong - returns unknown, caller casts with as
async function apiFetch(path: string): Promise<unknown> {
  const res = await fetch(path);
  return res.json();
}
const data = (await apiFetch("/events")) as { items: Event[] };
```

Don't build objects imperatively with a mutable `Record<string, unknown>` — construct them inline as a single expression. TypeScript infers the type automatically.

```typescript
// ✅ Correct - single inline object, no type annotation needed
const data = await apiFetch<Event>(`/events/${id}`, {
  method: "PATCH",
  body: JSON.stringify({
    summary: params.title,
    start: params.start ? { dateTime: params.start } : undefined,
    description: params.description,
  }),
});
```

```typescript
// ❌ Wrong - mutable object, needs explicit type, multiple statements
const body: Record<string, unknown> = {};
if (params.title !== undefined) body.summary = params.title;
if (params.start !== undefined) body.start = { dateTime: params.start };
if (params.description !== undefined) body.description = params.description;
const data = (await apiFetch(`/events/${id}`, {
  method: "PATCH",
  body: JSON.stringify(body),
})) as Event;
```

---

## Inline single-use schemas and variables

Don't extract a variable for something used only once. Inline it.

```typescript
// ✅ Correct - inline the schema
search: m({
  params: z.object({
    query: z.string(),
    topic: z.enum(["general", "news"]).optional(),
  }),
})
```

```typescript
// ❌ Wrong - extracted variable used once
const searchParams = z.object({
  query: z.string(),
  topic: z.enum(["general", "news"]).optional(),
});

search: m({
  params: searchParams,
})
```

---

## Never add redundant type annotations

Never annotate a type that TypeScript already infers. Explicit annotations on variables, return types, and parameters are noise when the compiler knows the type.

Always start without type annotations. If eslint complains about an unresolved type, fix the underlying issue — don't add a type annotation as a workaround. Annotations to "help eslint" or "work around deep type inference" are never acceptable.

```typescript
// ✅ Correct - type is inferred
const baseUrl = c.get("baseUrl");
const items = rows.map((r) => r.id);
const logs = await api.fetch("/api/agents/:agentId/logs", "GET", { ... });
```

```typescript
// ❌ Wrong - redundant annotation
const baseUrl: string = c.get("baseUrl");
const items: string[] = rows.map((r) => r.id);
// ❌ Wrong - "workaround" annotation for eslint type resolution
const logs: AgentLogRow[] = await api.fetch("/api/agents/:agentId/logs", "GET", { ... });
```

---

## Never force-cast with `as` — use `satisfies` or runtime narrowing

Never use `as Type` to force values into a type. If the type doesn't match, fix the source — don't cast it away. When you need to validate that a value conforms to a type without widening it, use `satisfies`.

When a value is genuinely untyped at runtime (e.g. a Lambda event that could be multiple shapes), use `unknown` with runtime narrowing (`typeof`, `in`). Never cast to a concrete type like `Record<string, string>` — that's a lie if the value can be any shape.

```typescript
// ✅ Correct - satisfies validates without casting
return { role: msg.role, content: [tsBlock, ...msg.content] } satisfies Anthropic.MessageParam;

// ✅ Correct - unknown + runtime narrowing for untyped input
// eslint-disable-next-line @typescript-eslint/no-restricted-types
const event: unknown = args[0];
if (typeof event === "object" && event !== null && "source" in event && event.source === "warmer") {
  return;
}
```

```typescript
// ❌ Wrong - as cast hides type mismatches
return { role: "assistant", content: msg.content as Anthropic.ContentBlock[] };

// ❌ Wrong - lies about the type when the value can be any shape
const event = args[0] as Record<string, string>;
if (event.source === "warmer") { ... }
```

---

## Always parse timestamps with `new Date()` — never slice raw strings

Never extract date parts by slicing a timestamp string. Always parse into a `Date` object first, then format.

```typescript
// ✅ Correct - parse then format
const day = new Date(row.created_at).toISOString().slice(0, 10);
```

```typescript
// ❌ Wrong - slicing a raw string assumes format
const day = row.created_at.slice(0, 10);
```

---

## Use lodash `chain()` for data transformations — no nested function calls

When transforming arrays (group, map, sort, sum), use `chain()` from `lodash-es` with named imports. Never nest `Object.fromEntries(Object.entries(...).map(...))` or chain `reduce` → `map` → `sort` manually.

```typescript
// ✅ Correct - lodash chain, readable pipeline
import { chain, sumBy } from "lodash-es";

const dailyCosts = chain(rows)
  .groupBy((r) => new Date(r.created_at).toISOString().slice(0, 10))
  .map((dayRows, date) => ({
    date,
    breakdown: chain(dayRows)
      .groupBy((r) => r.usage.type)
      .map((typeRows, type) => ({ type, costUsd: sumBy(typeRows, "cost_usd") }))
      .value(),
  }))
  .sortBy("date")
  .value();
```

```typescript
// ❌ Wrong - nested imperative code
const grouped = new Map<string, typeof rows>();
for (const r of rows) {
  const date = new Date(r.created_at).toISOString().slice(0, 10);
  if (!grouped.has(date)) grouped.set(date, []);
  grouped.get(date)!.push(r);
}
const dailyCosts = [...grouped.entries()]
  .map(([date, dayRows]) => ({ date, breakdown: ... }))
  .sort((a, b) => a.date.localeCompare(b.date));
```

Always use named imports (`import { chain, sumBy } from "lodash-es"`), never default import (`import _ from "lodash-es"`) — the default import causes ESLint `no-unsafe-*` errors.

---

## Prefer application-level defaults over SQL defaults

Set default values in application code, not in SQL `DEFAULT` clauses. This keeps business logic in one place and makes the Insert type match the Row type (no optional fields).

Exception: `gen_random_uuid()` for primary keys is fine as a SQL default.

```sql
-- ✅ Correct - no SQL default, application provides the value
create table client_authorizations (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  ...
);
```

```typescript
// ✅ Correct - application sets the default
.insert({
  status: "pending",
  device_info: { ... },
  ...
})
```

```sql
-- ❌ Wrong - default hidden in SQL
create table client_authorizations (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  ...
);
```

---

## Test file names must match subject file names

Unit test files must be named after the source file they test: `foo.ts` → `__tests__/foo.test.ts`. Don't split tests for a single source file across multiple test files.

```
# ✅ Correct
src/agent-runtime/executor.ts       → __tests__/executor.test.ts
src/agent-runtime/type-check.ts     → __tests__/type-check.test.ts
```

```
# ❌ Wrong — split across multiple files
src/agent-runtime/executor.ts       → __tests__/executor.test.ts
                                      __tests__/executor-type-check.test.ts
```

---

## Use typed `entries()`, `values()`, `mapValues()`, `mapEntries()` — never raw `Object.entries`/`Object.values`

`Object.entries()` and `Object.values()` lose value types (returns `[string, unknown][]` / `unknown[]`), especially with Zod v4 records. Use the typed helpers from `src/lib/object.ts` instead. Never use `Object.keys()` + index as a workaround — it's verbose and ugly.

```typescript
// ✅ Correct - typed helpers
import { entries, values, mapValues, mapEntries } from "../lib/object.js";

entries(record).forEach(([key, value]) => { ... });
values(record).forEach((v) => { ... });
const mapped = mapValues(record, (v) => transform(v));
const remapped = mapEntries(record, (key, value) => [newKey, newValue]);
```

```typescript
// ❌ Wrong - loses types
for (const [key, value] of Object.entries(record)) { ... }
Object.values(record).map((v) => ...);
Object.fromEntries(Object.entries(record).map(([k, v]) => [k, transform(v)]));

// ❌ Also wrong - verbose workaround
for (const key of Object.keys(record)) {
  const value = record[key];
  ...
}
```

---

## Prefer functional style when it reduces indentation

Use `.forEach()`, `.map()`, `.filter()` over `for...of` when iterating entries/values — it keeps the data flow flat. Reserve `for...of` only when you need early `return`/`break` from the enclosing function.

```typescript
// ✅ Correct - flat, functional
entries(methods).forEach(([name, method]) => {
  instance[name] = buildHandler(method);
});
```

```typescript
// ❌ Wrong - unnecessary indentation from for...of destructuring
for (const [name, method] of entries(methods)) {
  instance[name] = buildHandler(method);
}
```

---

## Use `warning.ifSlow` for recurring tasks that could stall

When a task runs on a recurring interval (e.g. `cron_tick` every 1 minute), wrap potentially slow operations with `warning.ifSlow` to detect when they exceed expected duration. If a recurring task takes longer than its interval, it can pile up and cause cascading failures.

```typescript
// ✅ Correct — detects when a recurring operation takes too long
import { warning } from "./developer-warning.js";

await warning.ifSlow("refreshOauth2Skills", { ms: 1000, log: () => ({ skillId }) }, async () => {
  const { data: rows } = await serviceClient.get().from("user_skills").select().throwOnError();
  // ... process rows
});
```

```typescript
// ❌ Wrong — no visibility into slow operations that run every minute
const { data: rows } = await serviceClient.get().from("user_skills").select().throwOnError();
// ... process rows
```

---

## Never use `""` to mean "no value" — use `null`

Empty string is a legitimate value (a user cleared a text input, a field was explicitly blanked). `null` / `undefined` is the absence of a value. Conflating the two is a type lie: the signature claims "always a string," callers have to guess whether `""` means "really empty" or "missing," and bugs slip through compaction / truthiness checks.

```typescript
// ✅ Correct — null signals absence, "" signals "empty string value"
function metadataText(m: Metadata): string | null {
  switch (m.type) {
    case "call":     return m.counterpart.length > 0 ? m.counterpart.join(", ") : null;
    case "document": return m.source?.id ?? null;
  }
}

const text = chain([title, body, metadataText(m)])
  .compact()      // drops null/undefined — also "" if it's literally empty
  .join("\n\n")
  .value();
```

```typescript
// ❌ Wrong — returning "" to mean "no metadata"
function metadataText(m: Metadata): string {
  switch (m.type) {
    case "call":     return m.counterpart.join(", ");   // could be ""
    case "document": return m.source?.id ?? "";          // lies: missing ≠ empty
  }
}
```

Same rule applies to object fields, API responses, database nullable columns: if a field is optional, type it as `T | null` and use `null` — not `T` with `""` as a sentinel.

---

## Cross-table SQL objects belong in the target table's migration

Triggers, indexes, RLS policies, and views that reference table X should live in the migration that creates X — not in a sibling's migration. Scattering dependencies across migrations creates a timeline hazard: deleting X's migration (during a cleanup, a feature removal, or a schema redesign) breaks `db-reset.ts` on a clean checkout because some peer migration still references the now-missing table.

Symptom: `ERROR: relation "public.X" does not exist` during replay, inside a migration whose own table still exists.

Each migration should be a self-contained chunk of schema that can be removed with the feature it belongs to. Cross-table artifacts tie unrelated features together on the SQL timeline — a "channels" migration that also installs a realtime trigger on `memory_nodes` means you can't drop `memory_nodes` without surgically editing the channels migration.

```sql
-- ✅ Correct — trigger lives in the table it watches
-- 20260212_create_memory_nodes.sql
create table memory_nodes (...);
create trigger memory_nodes_realtime_changes after insert or update or delete
  on memory_nodes for each row execute function broadcast_user_changes();
```

```sql
-- ❌ Wrong — trigger on memory_nodes stashed inside the channels migration
-- 20260213_create_channels.sql
create table channels (...);
create trigger memory_nodes_realtime_changes after insert or update or delete
  on memory_nodes for each row execute function broadcast_user_changes();
-- Later: delete 20260212_create_memory_nodes.sql → db reset breaks here
```

If a helper function (e.g. `broadcast_user_changes()`) is shared across tables, define it in its own earlier migration; then each table's migration creates its own trigger using it.

---

## Never `z.string()` for a value that comes from a known, closed set

When a user-supplied field is a category (a file kind, a MIME type, a status, a skill id…), the zod schema should pin it to the valid values. A free `z.string()` lets anything through and forces every handler to repeat the same membership check.

Use `z.enum([...])` for a flat list, `z.discriminatedUnion("kind", [...])` when one field constrains another, and `z.literal(...)` inside the union variants. Types infer to the exact string-literal union, which also kills `as` casts on callers.

```ts
// ✅ Correct — body pins contentType to the MIMEs registered for each kind.
const fileUploadBodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("audio"),
    contentType: z.enum(FILE_KINDS.audio.mimes),
  }),
  // add z.object({ type: z.literal("image"), contentType: z.enum(FILE_KINDS.image.mimes) }) when it's time
]);
```

```ts
// ❌ Wrong — "contentType: string" lets image/png through the audio path;
// every handler has to re-validate, and the type is string instead of a literal union.
body: {
  type: z.enum(["audio"]),
  contentType: z.string(),
}
```

---

## Don't invent per-field side-endpoints; decorate the parent resource

When a resource needs a derived value (a presigned URL, a joined name, a computed status), return it on the parent resource's GET response, not from a dedicated sidecar endpoint. The sidecar adds an endpoint to maintain, a second round trip, and a second permission check for the same entity.

```ts
// ✅ Correct — GET /api/memories/:id returns the row plus its derived url.
route("/api/memories/:id", "GET", {
  handler: async ({ params, c }) => {
    const memory = await memoriesRepo.getById(user.id, params.id);
    return { ...memory, audioUrl: memory.metadata.audioKey ? publicUrl(memory.metadata.audioKey) : null };
  },
});
```

```ts
// ❌ Wrong — a dedicated /audio/play-url endpoint that re-fetches the same memory just to return one derived field.
route("/api/memories/:id/audio/play-url", "GET", { handler: async ... });
```

Exception: derivation is expensive (multi-second), OR the caller is likely to want the parent *without* the derived value most of the time. Then a separate endpoint earns its keep.

---

## But aggregates over a child table go in a sidecar — never on the entity row

The opposite of the rule above: when the derived value is an **aggregate over a child collection** (event count per radar, message count per chat, file count per memory), it does NOT belong on the parent entity's row. The frontend's `useRepositoryListQuery` / `useRepositoryQuery` are typed against the DB row shape — adding `event_count: number` to `/api/radars` either pollutes the entity type with non-row fields (every consumer now sees them, including the realtime upsert path that has no way to compute them), or gets stripped at the repository boundary and silently lost.

Aggregates fan out and change with the children. They aren't a property of the parent row; they're a derived view. Put them in a sidecar endpoint named `/api/<parents>/counts` (or `/api/<parents>/:id/stats`), and have the frontend refetch on child-table repository events with a debounce.

```ts
// ✅ Correct — counts in a sidecar, parent stays a clean entity stream
route("/api/radars", "GET", {
  handler: async ({ c }) => radarRepo.list(c.get("requireUser")().id), // returns Radar[]
});

route("/api/radars/counts", "GET", {
  handler: async ({ c }) => radarRepo.countsByRadar(c.get("requireUser")().id),
  // returns [{ radar_id, event_count, unread_count }]
});
```

```ts
// ❌ Wrong — returns RadarWithCounts; frontend's useRepositoryListQuery
// either widens the entity type to include count fields (which the realtime
// upsert can't supply), or strips them silently.
route("/api/radars", "GET", {
  handler: async ({ c }) => radarRepoWithCounts.list(...), // returns Radar[] & { event_count, unread_count }
});
```

Frontend pattern: subscribe to the *child table's* repository events, debounce, refetch counts. Counts stay live without the frontend ever loading the full child collection.

How to tell which rule applies:
- **Single derived field about the entity itself** (URL, computed status, joined name) → put on the parent's GET response (rule above).
- **Aggregate that scales with a child collection** (counts, sums, latest-of) → sidecar endpoint, refetch on child repo events.

---

## File-storage paths should be entity-agnostic, not kind-segmented

Paths like `media/<user>/<memory>/audio/<uuid>.mp3` look neat until the same memory needs an image attachment, a transcript, a thumbnail — now deletion has to enumerate every kind, and the repo grows a switch per file type. Use `users/<user>/memories/<memory>/<uuid>.<ext>` and let the memory's metadata carry which key is which. Deletion becomes a single `ListObjectsV2` + `DeleteObjects` over the prefix.

Same rule for the repository: don't write `deleteAudioObject`, `audioKeyOf`, `deleteImageObject`. The repo deletes *files under a memory*; the kind-specific knowledge lives in the schema and the frontend.

```ts
// ✅ Correct — repo sweeps the whole memory prefix, kind-agnostic.
async function deleteMemoryFiles(userId: string, memoryId: string) {
  const Prefix = `users/${userId}/memories/${memoryId}/`;
  // list + bulk-delete, paginated
}
```

```ts
// ❌ Wrong — audio-specific helpers that multiply when we add image/video/transcript.
function audioKeyOf(m: MemoryMetadata): string | null { ... }
async function deleteAudioObject(key: string) { ... }
```

---

## All DB access goes through a repository

No file outside `packages/backend/src/**/*-repository.ts` may import `db` from `lib/db.js` (the Kysely instance). Routes, `lib/*`, and `agent-runtime/*` all call repo methods. The repo is the single layer that knows the data store — replacing Postgres with anything else means editing repo bodies, leaving every caller alone.

Tables get their own repo: `memoriesRepo`, `profilesRepo`, `chatSessionsRepo`. Related tables (e.g. `chat_sessions` + `chat_session_messages`) share a repo.

Scripts under `packages/backend/scripts/` are exempt — they're tooling that gets rewritten with the DB layer itself.

```ts
// ✅ Correct — route delegates to the repo
import { memoriesRepo } from "../../memories/memories-repository.js";

route("/api/memories/:id", "GET", {
  handler: async ({ params, c }) => {
    const user = c.get("requireUser")();
    return requireOrThrow(await memoriesRepo.getById(user.id, params.id), notFound);
  },
});
```

```ts
// ❌ Wrong — route reaches into the Kysely instance directly
import { db } from "../../lib/db.js";

route("/api/memories/:id", "GET", {
  handler: async ({ params, c }) => {
    const user = c.get("requireUser")();
    return await db.get().selectFrom("memories").selectAll().where("id", "=", params.id)...
  },
});
```

---

## Kysely is the query layer; types come from the overlay, not the raw codegen

The Kysely `Database` interface used in repos comes from `packages/backend/src/types/database.ts`, which overlays:
1. **jsonb columns** (e.g. `memories.metadata`) retyped from raw `Json` to their actual TS shape (`MemoryMetadata`, etc.)
2. **`Timestamp` columns** remapped to `ColumnType<string, Date | string, Date | string>` so `Selectable<Row>.created_at` is `string` — matches the JSON wire format

`packages/backend/src/types/database.kysely.generated.ts` is the raw introspection from `kysely-codegen --include-pattern '{public,better_auth}.*'`. Don't import from it directly — always go through the overlay (`Database`, `Selectable<Database["X"]>`, or the named row aliases like `MemoryRow`).

The pg driver in `lib/db.ts` is configured to parse `timestamp` / `timestamptz` as ISO 8601 strings via `pgTypes.setTypeParser(1114 / 1184, (val) => new Date(val).toISOString())`. The overlay matches that runtime behavior. Don't add type parsers elsewhere or override the Timestamp mapping — the chain is calibrated end-to-end.

To regenerate types after a migration:
```bash
./packages/backend/scripts/db_gen_types.ts
```

---

## Never call `.throwOnError()` on Kysely queries

`.throwOnError()` is a Supabase-specific call. Kysely throws on DB errors by default — the `pg` driver throws (connection failure, syntax error, constraint violation, etc.) and Kysely propagates the rejection. There's no `{ data, error }` tuple to unwrap.

Pick the right terminator instead:
- **`.execute()`** → returns `T[]` (zero or more rows)
- **`.executeTakeFirst()`** → returns `T | undefined` (zero rows = `undefined`, *not* an error)
- **`.executeTakeFirstOrThrow()`** → returns `T` (throws `NoResultError` if zero rows)

```ts
// ✅ Correct — get-by-id can legitimately miss; route translates to 404
async getById(userId: string, id: string): Promise<Memory | null> {
  const row = await db.get()
    .selectFrom("memories").selectAll()
    .where("id", "=", id).where("user_id", "=", userId)
    .executeTakeFirst();
  return row ?? null;
}
```

```ts
// ✅ Correct — insert that must succeed
async create(userId: string, input: MemoryWriteInput): Promise<Memory> {
  return await db.get()
    .insertInto("memories")
    .values({ user_id: userId, ...input })
    .returningAll()
    .executeTakeFirstOrThrow();
}
```

```ts
// ❌ Wrong — .throwOnError() is a no-op in Kysely; caller wonders if errors are swallowed
const row = await db.get().selectFrom("memories")...executeTakeFirst().throwOnError();
```

---

## Verify the unique constraint exists before writing `ON CONFLICT (col)`

Postgres throws at runtime if `ON CONFLICT (col)` doesn't match an existing `UNIQUE` or `PRIMARY KEY` constraint:

```
no unique or exclusion constraint matching the ON CONFLICT specification
```

Before adding `.onConflict((oc) => oc.column("X").doUpdateSet(...))`, open the migration file and confirm `X` is in a `PRIMARY KEY` or `UNIQUE` clause. The Supabase `.upsert()` API hid this footgun by defaulting to `ON CONFLICT (id)` — auto-generated ids never collide, so the upsert silently degraded to a plain insert. Kysely makes you state the column explicitly, which means you have to verify it.

```ts
// ✅ Correct — profiles PK is user_id
await db.get()
  .insertInto("profiles")
  .values({ user_id, ...rest })
  .onConflict((oc) => oc.column("user_id").doUpdateSet({ ...rest }))
  .execute();
```

```ts
// ❌ Wrong — user_skills PK is `id`; no unique on user_id; Postgres errors at runtime
await db.get()
  .insertInto("user_skills")
  .values({ user_id, data })
  .onConflict((oc) => oc.column("user_id").doUpdateSet({ data }))  // crashes
  .execute();

// ✅ Correct for that case — just insert (the original `.upsert(.)` was a misnamed insert all along)
await db.get()
  .insertInto("user_skills")
  .values({ user_id, data })
  .returningAll()
  .executeTakeFirstOrThrow();
```

If you want true upsert semantics on a non-PK column, add a `UNIQUE` constraint via migration first.

---

## Scripts: wrap every entry-point body in `main()`, never use top-level `await`

Every `*.ts` under `packages/backend/scripts/` and `scripts/` wraps its body in a `main()` function. Async scripts end with `main().catch(...)`; sync scripts just call `main()`. Top-level `await` in entry-point scripts mixes initialization with execution flow, buries error handling, and makes error exit codes non-obvious.

```ts
// ✅ Correct — async script
async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // ...
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```ts
// ✅ Correct — sync script
function main(): void {
  const r = spawnSync("docker", [...], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

main();
```

```ts
// ❌ Wrong — top-level await, no error handler
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
// ...
await client.end();
```

---

## Scripts: one file per command, snake_case with a domain prefix, npm script key mirrors the filename

Don't build subcommand dispatchers inside a single `.ts` (`db.ts start|stop|status|shell`) — split into one file per command. Filenames use snake_case with a domain prefix; the npm script key mirrors the filename (`db:start` → `db_start.ts`). Shared helpers live in `scripts/lib/<domain>.ts`.

```
packages/backend/scripts/
├── db_start.ts         → npm run -w backend db:start
├── db_stop.ts          → npm run -w backend db:stop
├── db_status.ts        → npm run -w backend db:status
├── db_shell.ts         → npm run -w backend db:shell
├── db_reset.ts         → ./packages/backend/scripts/db_reset.ts
├── db_migrate.ts       → ./packages/backend/scripts/db_migrate.ts
├── db_gen_types.ts     → ./packages/backend/scripts/db_gen_types.ts
└── lib/
    └── db_docker.ts    // shared helpers (dockerInspect, waitReady)
```

```json
// packages/backend/package.json
"scripts": {
  "db:start": "./scripts/db_start.ts",
  "db:stop": "./scripts/db_stop.ts",
  "db:status": "./scripts/db_status.ts",
  "db:shell": "./scripts/db_shell.ts"
}
```

Why: each script is its own CI-inspectable unit, grep hits go to the right file, and the shebang-runnable convention (CLAUDE.md) maps 1:1 to the npm script key. Subcommand dispatchers add a layer of cognitive overhead per invocation and bury which code actually runs.

---

## Never add compat stubs for infrastructure you've removed

If a historical migration references objects that came from a system you're no longer using (e.g. Supabase's `auth.users` / `auth.uid()` / `authenticated` role after a Supabase → plain Postgres migration), **rewrite the migration to be honest**. Don't add a stub migration that fakes the missing objects.

Fakes accrete — later devs see the stub, assume the objects matter, build more on top. Migrations aren't archival history of what the schema ever looked like; they're the replayable definition of what it IS now. Edit freely as long as no production DB has drifted state that depends on the old form.

```sql
-- ❌ Wrong — stub migration that recreates vanished Supabase infra
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, ...);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT NULL::uuid $$ LANGUAGE sql;
CREATE ROLE IF NOT EXISTS authenticated NOLOGIN;
```

```sql
-- ✅ Correct — the original user_skills migration, edited to drop the auth.users FK
-- (added in a later migration to better_auth.user) and the auth.uid() RLS policy
-- (no longer used at all)
create table user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,  -- FK to better_auth.user added in 20260222
  "data" jsonb not null,
  created_at timestamptz not null default now()
);
```

Parallel cleanup: if a migration's *entire content* becomes obsolete (a pure-RLS migration whose policies get dropped, a backfill migration whose source table no longer exists), delete the file. The `_migrations` tracking table only records applied versions; missing files aren't errors on replay.

---

## Repos are pure data — routes own HTTP semantics via `requireOrThrow`

Repo methods never throw `HTTPException`. Not-found returns `T | null` (or `boolean` for existence checks). The route layer translates null → HTTP status via the `requireOrThrow` helper in `lib/require-or-throw.js`. This keeps repos reusable from non-HTTP contexts (CLI, worker, gRPC) without importing `hono` or translating exceptions at every call.

The error factory passed to `requireOrThrow` is lazy — the `new HTTPException` cost only happens on the miss path. Hoist it to a module-level `const` per resource so every callsite reuses the same message.

Ownership / authorization checks that *aren't* "row missing" also live at the route layer. The repo exposes the predicate (e.g. `chatSessionsRepo.existsForUser`) and the route decides whether that's a 422 or a 404.

```ts
// ✅ Correct — repo returns nullable, route narrows
// memories-repository.ts
async getById(userId: string, id: string): Promise<Memory | null> {
  const { data } = await serviceClient.get()...maybeSingle().throwOnError();
  return data;
}

// routes/memory.ts
const notFound = () => new HTTPException(404, { message: "Memory not found" });

route("/api/memories/:id", "GET", {
  handler: async ({ params, c }) => {
    const user = c.get("requireUser")();
    return requireOrThrow(await memoriesRepo.getById(user.id, params.id), notFound);
  },
});
```

```ts
// ❌ Wrong — repo throws HTTPException, couples data layer to HTTP
async getById(userId: string, id: string): Promise<Memory> {
  const { data } = await serviceClient.get()...maybeSingle().throwOnError();
  if (!data) throw new HTTPException(404, { message: "Memory not found" });
  return data;
}
```

Exception: agent-runtime / skill-runtime handlers aren't HTTP either. Throw plain `Error` there and let the runtime's error handler surface it.

---

## Never manually fix lint errors

Always run ESLint with `--fix`. Never hand-edit code to fix lint issues.

```bash
./packages/backend/scripts/lint.ts --fix
```

---

## Always pass `ssl: pgSsl()` to every `new pg.Pool()` / `new pg.Client()`

`node-postgres` **ignores** `sslmode` in the connection string — the only way to enable TLS is to pass an explicit `ssl` object. Aurora (and any non-localhost Postgres host) rejects unencrypted connections with:

```
error: no pg_hba.conf entry for host "...", user "postgres", database "...", no encryption
```

The footgun is that `localhost:5432` works without TLS, so the bug is invisible in dev and crashes the first time a script or new module touches production. Use the `pgSsl()` helper from `packages/backend/src/lib/pg-ssl.ts` for every pg client — it returns `false` for localhost / 127.0.0.1 / host.docker.internal and `{ rejectUnauthorized: false }` for everything else.

Affected callsites: `lib/db.ts` (Kysely pool), `lib/auth.ts` (better-auth pool), `lambda-api/dev-login.ts`, every script under `scripts/` that opens its own client (`db_migrate.ts`, `db_reset.ts`, `lib/seed-persona.ts`). When you add a new pg client, search for `new Pool({` / `new pg.Client({` and copy the same shape.

```typescript
// ✅ Correct
import { pgSsl } from "../lib/pg-ssl.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: pgSsl() });
```

```typescript
// ❌ Wrong — works locally, fails on Aurora at runtime
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

```typescript
// ❌ Also wrong — sslmode in URL is silently ignored by node-postgres
const url = `${process.env.DATABASE_URL}?sslmode=require`;
const pool = new Pool({ connectionString: url });
```

---

## CDK-synthesized env vars override .env values — order them last in `sharedEnv`

In `scripts/lib/backend-stack.ts`, the Lambda environment is a single object that mixes values from `.env.production` with values CDK derives at synth time (e.g. `DATABASE_URL` from the generated Aurora secret, `AGENT_STORAGE_BUCKET` from the S3 bucket, `APP_BASE_URL` from CORS config).

The CDK-derived values must be the source of truth — the matching keys in `.env.production` are stale leftovers from before the resource was provisioned. Spread `...props.envVars` first, then list every CDK override **after** it. Reverse the order and the `.env` value silently wins, deploying the wrong endpoint with no error.

```typescript
// ✅ Correct — CDK overrides come last and win
const sharedEnv = {
  NODE_ENV: "production",
  ...props.envVars,
  AGENT_STORAGE_BUCKET: agentBucket.bucketName,
  APP_BASE_URL: props.appBaseUrl,
  DATABASE_URL: databaseUrl,
};
```

```typescript
// ❌ Wrong — .env DATABASE_URL silently overrides the synth-time value
const sharedEnv = {
  NODE_ENV: "production",
  AGENT_STORAGE_BUCKET: agentBucket.bucketName,
  DATABASE_URL: databaseUrl,
  ...props.envVars,
};
```
