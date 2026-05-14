import type { z } from "zod";

import type { JsonValue } from "../types/json.js";
import type { executeCodeTool } from "./tools.js";

/**
 * LlmMessage — the internal shape used to feed messages into the LLM.
 * Distinct from chat_session_messages rows: those are persisted, these are
 * derived per-turn from the rows and fed into Anthropic.
 */
export type LlmMessage =
  | {
    role: "assistant";
    content: Array<LlmAssistantContentBlock>;
  }
  | {
    role: "user";
    content: Array<LlmUserContentBlock>;
  };

export type LlmAssistantMessage = Extract<LlmMessage, { role: "assistant" }>;

export type LlmAssistantContentBlock =
  | { type: "text"; text: string }
  | {
    type: "tool_use";
    id: string;
    name: "executeCode";
    input: z.infer<typeof executeCodeTool.input>;
  };

export type LlmUserContentBlock =
  | { type: "text"; text: string }
  | {
    type: "tool_result";
    tool_use_id: string;
    result: { reads: JsonValue[]; error?: string };
  };
