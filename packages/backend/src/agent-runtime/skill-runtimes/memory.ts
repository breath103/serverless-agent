import { z } from "zod";

import { publishRealtimeEvent } from "../../lib/realtime-publish.js";
import { memoriesRepo } from "../../memories/memories-repository.js";
import { defineSkillRuntime } from "./define.js";

const memorySchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const memorySearchMatchSchema = z.object({
  id: z.string(),
  title: z.string(),
  rank: z.number(),
});

export const memory = defineSkillRuntime("memory", {
  instanceDescription: () => "",
  create: (instanceId, config, { userId }: { userId: string }) => ({ userId }),

  entities: {
    Memory: memorySchema,
    MemorySearchMatch: memorySearchMatchSchema,
  },

  methods: (m) => ({
    search: m({
      params: z.object({
        query: z.string(),
        limit: z.number().optional(),
      }),
      returns: z.array(memorySearchMatchSchema),
      handler: async (ctx, params) => {
        return await memoriesRepo.search(ctx.userId, params.query, params.limit);
      },
    }),

    get: m({
      params: z.object({ ids: z.array(z.string().uuid()) }),
      returns: z.array(memorySchema),
      handler: async (ctx, params) => {
        return await memoriesRepo.getByIds(ctx.userId, params.ids);
      },
    }),

    create: m({
      params: z.object({
        title: z.string().min(1),
        content: z.string(),
      }),
      returns: memorySchema,
      handler: async (ctx, params) => {
        const row = await memoriesRepo.create(ctx.userId, params);
        await publishRealtimeEvent(ctx.userId, { type: "entity_update", table: "memories", op: "upsert", row });
        return row;
      },
    }),

    update: m({
      params: z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
      }),
      returns: memorySchema,
      handler: async (ctx, { id, ...patch }) => {
        const row = await memoriesRepo.update(ctx.userId, id, patch);
        if (!row) throw new Error(`Memory ${id} not found`);
        await publishRealtimeEvent(ctx.userId, { type: "entity_update", table: "memories", op: "upsert", row });
        return row;
      },
    }),
  }),
});
