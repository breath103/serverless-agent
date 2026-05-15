import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { generateChatTitleInBackground } from "../../agent-runtime/generate-chat-title.js";
import { runChatInBackground } from "../../agent-runtime/start-chat-session.js";
import { chatSessionsRepo } from "../../chat-sessions/chat-sessions-repository.js";
import { route } from "../../lib/app-context.js";
import { publishRealtimeEvent } from "../../lib/realtime-publish.js";
import { taggedConfig } from "../../skills/index.js";
import { TELEGRAM_SECRET_HEADER } from "../../skills/telegram.js";
import { userSkillsRepo } from "../../skills/user-skills-repository.js";

// Minimal slice of the Telegram Update we care about. Other update kinds
// (edited_message, channel_post, callback_query, ...) are ignored.
const ChatSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  type: z.string(),
});
const MessageSchema = z.object({
  chat: ChatSchema,
  text: z.string().optional(),
  caption: z.string().optional(),
  photo: z.unknown().optional(),
  video: z.unknown().optional(),
  voice: z.unknown().optional(),
  audio: z.unknown().optional(),
  document: z.unknown().optional(),
  sticker: z.unknown().optional(),
}).passthrough();
const UpdateSchema = z.object({
  update_id: z.number(),
  message: MessageSchema.optional(),
}).passthrough();

/** Turn a Telegram message into the user-message text our agent sees. */
function renderInboundText(msg: z.infer<typeof MessageSchema>): string | null {
  const placeholders: string[] = [];
  if (msg.photo !== undefined) placeholders.push("[image] - not supported yet");
  if (msg.video !== undefined) placeholders.push("[video] - not supported yet");
  if (msg.voice !== undefined) placeholders.push("[voice message] - not supported yet");
  if (msg.audio !== undefined) placeholders.push("[audio] - not supported yet");
  if (msg.document !== undefined) placeholders.push("[document] - not supported yet");
  if (msg.sticker !== undefined) placeholders.push("[sticker] - not supported yet");

  const text = msg.text ?? msg.caption ?? "";
  const joined = [text, ...placeholders].filter(Boolean).join("\n");
  return joined.length > 0 ? joined : null;
}

export const routes = [
  route("/api/telegram/webhook/:userId/:userSkillId", "POST", {
    body: UpdateSchema,
    handler: async ({ params, body, c }) => {
      const row = await userSkillsRepo.getByIdForUser(params.userId, params.userSkillId);
      if (!row || row.data.skill_id !== "telegram") {
        throw new HTTPException(404, { message: "Webhook target not found" });
      }
      const presented = c.req.header(TELEGRAM_SECRET_HEADER) ?? "";
      if (presented !== row.data.config.webhook_secret) {
        throw new HTTPException(401, { message: "Bad secret token" });
      }

      if (!body.message) return { ok: true };
      const msg = body.message;

      // Group-chat traffic would otherwise bind the skill to a group on first message.
      if (msg.chat.type !== "private") return { ok: true };

      if (row.data.config.telegram_chat_id !== null && row.data.config.telegram_chat_id !== msg.chat.id) {
        return { ok: true };
      }

      const userMessageText = renderInboundText(msg);
      if (!userMessageText) return { ok: true };

      const userId = row.user_id;
      const existingSessionId = row.data.config.chat_session_id;

      if (existingSessionId === null) {
        // First inbound: write the skill-row binding BEFORE spawning the chat
        // loop. `runChatTurn` reads `telegramTargets` at the top of the turn
        // (before the LLM call) — if the binding lands after that read, the
        // outbound dispatcher silently no-ops on this turn's reply.
        const session = await chatSessionsRepo.createGenerating(userId, "user");
        await userSkillsRepo.updateData(userId, row.id, taggedConfig("telegram", {
          ...row.data.config,
          telegram_chat_id: msg.chat.id,
          chat_session_id: session.id,
        }));
        await publishRealtimeEvent(userId, { type: "entity_update", table: "chat_sessions", op: "upsert", row: session });
        runChatInBackground({ userId, sessionId: session.id, userMessageText });
        void generateChatTitleInBackground({ userId, sessionId: session.id, userMessageText });
        return { ok: true };
      }

      const session = await chatSessionsRepo.beginGenerating(userId, existingSessionId);
      if (!session) {
        console.warn(`[telegram-webhook] user=${userId} session=${existingSessionId} busy; dropped inbound`);
        return { ok: true };
      }
      await publishRealtimeEvent(userId, { type: "entity_update", table: "chat_sessions", op: "upsert", row: session });
      runChatInBackground({ userId, sessionId: session.id, userMessageText });
      return { ok: true };
    },
  }),
] as const;
