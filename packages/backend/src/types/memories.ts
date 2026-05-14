import { z } from "zod";

import type { MemoryRow } from "./database.js";

export const memoryWriteInputSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
});
export type MemoryWriteInput = z.infer<typeof memoryWriteInputSchema>;

export const memoryPatchSchema = memoryWriteInputSchema.partial();
export type MemoryPatch = z.infer<typeof memoryPatchSchema>;

export type Memory = MemoryRow;

export type MemorySearchMatch = {
  id: string;
  title: string;
  rank: number;
};
