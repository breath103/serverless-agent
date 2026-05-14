import type { ChatSessionMessageData } from "../lib/realtime-events.js";
import type { LlmMessage } from "./llm-message.js";

/**
 * Build the LLM's conversation history from persisted rows.
 *
 * Rows are already in chronological order (caller's responsibility).
 * Coalesces adjacent rows of the same "speaker" (user→user | assistant→assistant)
 * into one LlmMessage with multiple content blocks — Anthropic requires
 * alternating roles, and multiple assistant parts of one turn should be
 * one assistant message.
 */
export function rowsToLlmMessages(rows: { data: ChatSessionMessageData }[]): LlmMessage[] {
  const messages: LlmMessage[] = [];

  for (const row of rows) {
    const { data } = row;

    if (data.role === "user") {
      const last = messages.at(-1);
      if (last?.role === "user") {
        last.content.push({ type: "text", text: data.content.text });
      } else {
        messages.push({ role: "user", content: [{ type: "text", text: data.content.text }] });
      }
      continue;
    }

    // data.role === "assistant"
    const last = messages.at(-1);

    switch (data.content.kind) {
      case "text": {
        if (last?.role === "assistant") {
          last.content.push({ type: "text", text: data.content.text });
        } else {
          messages.push({ role: "assistant", content: [{ type: "text", text: data.content.text }] });
        }
        break;
      }
      case "tool_call": {
        const block = {
          type: "tool_use" as const,
          id: data.content.tool_call_id,
          name: "executeCode" as const,
          input: data.content.input,
        };
        if (last?.role === "assistant") {
          last.content.push(block);
        } else {
          messages.push({ role: "assistant", content: [block] });
        }
        break;
      }
      case "tool_result": {
        // Anthropic expects tool_result inside a user message; our schema puts
        // it under an assistant row (semantically it's the outcome of the
        // assistant's tool call), so we emit it to the user side of the history.
        // Feed back ONLY `reads` — skillCalls is UI-only and must never be seen
        // by the LLM (would pollute context with large already-rendered data).
        const block = {
          type: "tool_result" as const,
          tool_use_id: data.content.tool_call_id,
          result: data.content.error
            ? { reads: data.content.reads, error: data.content.error }
            : { reads: data.content.reads },
        };
        if (last?.role === "user") {
          last.content.push(block);
        } else {
          messages.push({ role: "user", content: [block] });
        }
        break;
      }
      case "error": {
        // Render an error part as an assistant text block so the LLM sees
        // it rendered inline. Turn-level failures beyond the LLM's control.
        const text = `[error] ${data.content.message}`;
        if (last?.role === "assistant") {
          last.content.push({ type: "text", text });
        } else {
          messages.push({ role: "assistant", content: [{ type: "text", text }] });
        }
        break;
      }
    }
  }

  return messages;
}
