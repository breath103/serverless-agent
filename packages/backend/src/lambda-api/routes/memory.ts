import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { route } from "../../lib/app-context.js";
import { publishRealtimeEvent } from "../../lib/realtime-publish.js";
import { requireOrThrow } from "../../lib/require-or-throw.js";
import { memoriesRepo } from "../../memories/memories-repository.js";
import { memoryPatchSchema, memoryWriteInputSchema } from "../../types/memories.js";

const notFound = () => new HTTPException(404, { message: "Memory not found" });

// Memories are plain markdown documents — no metadata, no file attachments.
// Static sub-paths (/search) are registered before the :id param route so they
// don't get captured as ids.
export const routes = [
  route("/api/memories/search", "GET", {
    query: {
      q: z.string().min(1),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    },
    handler: async ({ query, c }) => {
      const user = c.get("requireUser")();
      return await memoriesRepo.search(user.id, query.q, query.limit);
    },
  }),

  route("/api/memories", "GET", {
    query: {
      limit: z.coerce.number().int().min(1).max(100).optional(),
      before: z.string().optional(),
    },
    handler: async ({ query, c }) => {
      const user = c.get("requireUser")();
      return await memoriesRepo.list(user.id, { limit: query.limit, before: query.before });
    },
  }),

  route("/api/memories/:id", "GET", {
    handler: async ({ params, c }) => {
      const user = c.get("requireUser")();
      return requireOrThrow(await memoriesRepo.getById(user.id, params.id), notFound);
    },
  }),

  route("/api/memories", "POST", {
    body: memoryWriteInputSchema,
    handler: async ({ body, c }) => {
      const user = c.get("requireUser")();
      const memory = await memoriesRepo.create(user.id, body);
      await publishRealtimeEvent(user.id, { type: "entity_update", table: "memories", op: "upsert", row: memory });
      return memory;
    },
  }),

  route("/api/memories/:id", "PATCH", {
    body: memoryPatchSchema,
    handler: async ({ params, body, c }) => {
      const user = c.get("requireUser")();
      const updated = requireOrThrow(await memoriesRepo.update(user.id, params.id, body), notFound);
      await publishRealtimeEvent(user.id, { type: "entity_update", table: "memories", op: "upsert", row: updated });
      return updated;
    },
  }),

  route("/api/memories/:id", "DELETE", {
    handler: async ({ params, c }): Promise<{ ok: true }> => {
      const user = c.get("requireUser")();
      const deleted = requireOrThrow(await memoriesRepo.delete(user.id, params.id), notFound);
      await publishRealtimeEvent(user.id, { type: "entity_update", table: "memories", op: "delete", row: deleted });
      return { ok: true };
    },
  }),
] as const;
