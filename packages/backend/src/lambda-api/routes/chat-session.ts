import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { beginGenerating } from "../../agent-runtime/lifecycle.js";
import { continueChatSession, startChatSession } from "../../agent-runtime/start-chat-session.js";
import { chatSessionsRepo } from "../../chat-sessions/chat-sessions-repository.js";
import { route } from "../../lib/app-context.js";
import { publishRealtimeEvent } from "../../lib/realtime-publish.js";
import { requireOrThrow } from "../../lib/require-or-throw.js";

const MESSAGE_MAX = 4096;
const chatNotFound = () => new HTTPException(404, { message: "Chat not found" });
const chatBusy = () => new HTTPException(409, { message: "Chat not found or already generating" });

export const routes = [
  /** Create a new chat session seeded with an initial user message. */
  route("/api/chat", "POST", {
    body: {
      message: z.string().min(1).max(MESSAGE_MAX),
    },
    handler: async ({ body, c }) => {
      const user = c.get("requireUser")();
      return await startChatSession({ userId: user.id, kind: "user", userMessageText: body.message });
    },
  }),

  /** Append a user message to an existing chat. Fails 409 if chat is already generating. */
  route("/api/chat/:id/message", "POST", {
    body: {
      message: z.string().min(1).max(MESSAGE_MAX),
    },
    handler: async ({ params, body, c }) => {
      const user = c.get("requireUser")();

      const session = requireOrThrow(await beginGenerating(params.id, user.id), chatBusy);

      await continueChatSession({ userId: user.id, sessionId: session.id, userMessageText: body.message });

      return { ok: true as const };
    },
  }),

  route("/api/chat", "GET", {
    handler: async ({ c }) => {
      const user = c.get("requireUser")();
      return await chatSessionsRepo.listForUser(user.id);
    },
  }),

  route("/api/chat/:id", "GET", {
    handler: async ({ params, c }) => {
      const user = c.get("requireUser")();
      return requireOrThrow(await chatSessionsRepo.getByIdForUser(user.id, params.id), chatNotFound);
    },
  }),

  route("/api/chat/:id/messages", "GET", {
    handler: async ({ params, c }) => {
      const user = c.get("requireUser")();
      const owned = await chatSessionsRepo.existsForUser(user.id, params.id);
      if (!owned) throw chatNotFound();
      return await chatSessionsRepo.listMessagesAsc(params.id);
    },
  }),

  route("/api/chat/:id", "DELETE", {
    handler: async ({ params, c }): Promise<{ ok: true }> => {
      const user = c.get("requireUser")();
      const deleted = requireOrThrow(await chatSessionsRepo.deleteForUser(user.id, params.id), chatNotFound);
      await publishRealtimeEvent(user.id, { type: "entity_update", table: "chat_sessions", op: "delete", row: deleted });
      return { ok: true };
    },
  }),
] as const;
