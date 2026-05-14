import { z } from "zod";

/**
 * Single tool the LLM can invoke: executeCode.
 *
 * The tool's `input` + `result` schemas double as:
 *  1. The input_schema sent to Anthropic.
 *  2. Runtime validation at the sandbox boundary.
 */
export const executeCodeTool = {
  name: "executeCode" as const,
  description:
    "Execute JavaScript code in a sandboxed runtime. Use `read(value)` to surface a value back so you can inspect it. All runtime functions are async — use `await`.",
  input: z.object({
    description: z.string().describe(
      "A short, non-technical description of what this code block does, shown to the end user as a one-line label above the code. **Write this in the SAME LANGUAGE as the user's current message / system-prompt language preference.** Korean user → Korean description, English user → English, etc. Never default to English when the user is speaking another language. Example (Korean user): '오늘 일정을 확인하는 중이에요'.",
    ),
    code: z.string().describe("JavaScript / TypeScript code to execute."),
  }),
  result: z.discriminatedUnion("type", [
    z.object({ type: z.literal("success"), data: z.object({ reads: z.array(z.any()) }) }),
    z.object({ type: z.literal("failure"), data: z.object({ reads: z.array(z.any()), error: z.string() }) }),
  ]),
};

/** Exact input shape the LLM passes to executeCode. */
export type ExecuteCodeInput = z.infer<typeof executeCodeTool.input>;

/** Shape Anthropic expects for a tool definition. */
export type LlmToolDef = {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- JSONSchema spec is arbitrary keys
  input_schema: { type: "object"; [key: string]: unknown };
};

export function toolDefinitionsForLlm(): LlmToolDef[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema: _drop, ...schema } = executeCodeTool.input.toJSONSchema();
  return [{
    name: executeCodeTool.name,
    description: executeCodeTool.description,
    input_schema: { ...schema, type: "object" },
  }];
}
