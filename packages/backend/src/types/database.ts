import type { ChatSessionMessageData } from "../lib/realtime-events.js";
import type { InstallableSkillConfig } from "../skills/index.js";
import type { ProfileDebug } from "./profile.js";

/**
 * Plain TS row shapes for every persisted entity. Each shape mirrors the
 * DynamoDB item layout one-to-one — no Kysely, no Postgres, no codegen.
 *
 * Timestamps are ISO-8601 strings. Snake-case field names kept for continuity
 * with the rest of the codebase (and because DynamoDB is attribute-name
 * agnostic anyway).
 */

export type UserRow = {
  id: string;
  name: string;
  credits: number;
  created_at: string;
  updated_at: string;
};

export type AccountRow = {
  user_id: string;
  provider: "google";
  sub: string;
  email: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
  /** Unix epoch seconds — drives the DynamoDB TTL sweep. */
  expires_at_epoch: number;
  created_at: string;
};

export type ChatSessionKind = "user" | "internal";

export type ProfileRow = {
  user_id: string;
  name: string;
  language: string;
  timezone: string;
  about: string;
  debug: ProfileDebug | null;
  created_at: string;
  updated_at: string;
};

export type MemoryRow = {
  user_id: string;
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type ChatSessionRow = {
  user_id: string;
  id: string;
  title: string | null;
  is_generating: boolean;
  kind: ChatSessionKind;
  created_at: string;
  updated_at: string;
};

export type ChatSessionMessageRow = {
  session_id: string;
  id: string;
  /** Composite sort key `${created_at}#${id}` — enables chronological Queries. */
  created_at_id: string;
  data: ChatSessionMessageData;
  created_at: string;
};

/** @public — required from frontend */
export type UserSkillRow = {
  user_id: string;
  id: string;
  data: InstallableSkillConfig;
  created_at: string;
  updated_at: string;
};
