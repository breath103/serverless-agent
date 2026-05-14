import type { ExecuteCodeInput } from "../agent-runtime/tools.js";
import type { SkillCall } from "../agent-runtime/types.js";
import type {
  ChatSessionMessageRow,
  ChatSessionRow,
  MemoryRow,
  ProfileRow,
} from "../types/database.js";
import type { JsonValue } from "../types/json.js";

/**
 * Realtime event shapes — single source of truth for what the backend
 * publishes on a user's MQTT topic. Frontend imports these types directly
 * and trusts the wire payload (no runtime validation; producer is us).
 */

export type EchoEvent = {
  type: "echo";
  message: string;
  sentAt: number;
  publishedAt: number;
};

// Assistant-only content variants. The agent only has one tool (`executeCode`),
// so tool_call.input is narrowed to its exact shape — no `unknown` casts downstream.
export type AssistantMessageContent =
  | { kind: "text"; text: string }
  | { kind: "tool_call"; tool_call_id: string; name: "executeCode"; input: ExecuteCodeInput }
  | {
    kind: "tool_result";
    tool_call_id: string;
    /** Values the sandbox surfaced via `read(...)`. JSON-cloned, so always JsonValue. */
    reads: JsonValue[];
    /** UI-only trace. LLM never sees these; they're for rendering the agent's work. */
    skillCalls: SkillCall[];
    error?: string;
  }
  | { kind: "error"; message: string };

/** role + content are correlated: user is text-only, assistant is the full union. */
export type ChatSessionMessageData =
  | { role: "user"; content: { kind: "text"; text: string } }
  | { role: "assistant"; content: AssistantMessageContent };

/**
 * Tables broadcast to the client over MQTT. Each entry pairs the table name
 * with the concrete row shape, so producers can't mismatch the two and
 * consumers get typed `row` after narrowing by `table`.
 *
 * @public — required from frontend
 */
export type RealtimeTableRowMap = {
  memories: MemoryRow;
  chat_sessions: ChatSessionRow;
  chat_session_messages: ChatSessionMessageRow;
  profiles: ProfileRow;
};

/** @public — required from frontend */
export type RealtimeTableName = keyof RealtimeTableRowMap;

export type EntityUpdateEvent = {
  [T in RealtimeTableName]: {
    type: "entity_update";
    table: T;
    op: "upsert" | "delete";
    row: RealtimeTableRowMap[T];
  }
}[RealtimeTableName];

export type RealtimeEvent = EchoEvent | EntityUpdateEvent;
