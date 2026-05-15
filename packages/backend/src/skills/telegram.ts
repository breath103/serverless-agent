import z from "zod";

import { defineSkill } from "./define-skill.js";

const TelegramSkillConfigSchema = z.object({
  bot_token: z.string(),
  telegram_chat_id: z.string().nullable(),
  chat_session_id: z.string().nullable(),
  webhook_secret: z.string(),
  bot_username: z.string().nullable(),
});
type TelegramSkillConfig = z.infer<typeof TelegramSkillConfigSchema>;

/** Header name Telegram uses for our webhook secret. Shared with the webhook route + e2e. */
export const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

function baseUrl(token: string): string {
  const base = process.env.TELEGRAM_BOT_API_BASE ?? "https://api.telegram.org";
  return `${base}/bot${token}`;
}

const TelegramErrorSchema = z.object({ ok: z.literal(false), description: z.string() });
const TelegramOkSchema = z.object({ ok: z.literal(true) }).passthrough();

async function callTelegram<T>(token: string, method: string, body: object, resultSchema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${baseUrl(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- untyped JSON wire body; validated below
  const data: unknown = await res.json();
  const err = TelegramErrorSchema.safeParse(data);
  if (err.success) throw new Error(`telegram ${method}: ${err.data.description}`);
  const ok = TelegramOkSchema.safeParse(data);
  if (!ok.success) throw new Error(`telegram ${method}: malformed response — ${ok.error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- generic JSON wire payload, validated by resultSchema below
  return resultSchema.parse((data as { result: unknown }).result);
}

export async function telegramGetMe(token: string): Promise<{ bot_username: string }> {
  const result = await callTelegram(token, "getMe", {}, z.object({ username: z.string() }));
  return { bot_username: result.username };
}

export async function telegramSetWebhook(token: string, url: string, secretToken: string): Promise<void> {
  await callTelegram(token, "setWebhook", {
    url,
    secret_token: secretToken,
    drop_pending_updates: true,
  }, z.boolean());
}

export async function telegramDeleteWebhook(token: string): Promise<void> {
  await callTelegram(token, "deleteWebhook", { drop_pending_updates: true }, z.boolean());
}

/**
 * Send a message back to Telegram. Tries MarkdownV2 first; on 400 retries
 * once with plain text — we lose formatting but never drop the delivery
 * because of a stray underscore in the assistant's reply.
 */
export async function telegramSendMessage(token: string, chatId: string, text: string): Promise<void> {
  try {
    await callTelegram(token, "sendMessage", {
      chat_id: chatId,
      text: escapeMarkdownV2(text),
      parse_mode: "MarkdownV2",
    }, z.object({}).passthrough());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("can't parse entities") && !msg.includes("parse")) throw err;
    await callTelegram(token, "sendMessage", { chat_id: chatId, text }, z.object({}).passthrough());
  }
}

// Telegram's MarkdownV2 requires escaping these characters everywhere they
// don't open/close a formatting marker. The simplest correct approach is to
// escape them all unconditionally — the rendered text reads identically
// (Telegram strips the backslashes for display) and we never 400.
const MD_V2_SPECIALS = /([_*[\]()~`>#+\-=|{}.!\\])/g;
function escapeMarkdownV2(text: string): string {
  return text.replace(MD_V2_SPECIALS, "\\$1");
}

export const telegram = defineSkill({
  id: "telegram",
  displayName: "Telegram",
  description: "Bidirectional Telegram chat mirror",
  configSchema: TelegramSkillConfigSchema,
  eventSchema: z.never(),
  install: {
    type: "telegram",
    uninstall: async (config: TelegramSkillConfig) => {
      await telegramDeleteWebhook(config.bot_token).catch(() => {});
    },
  } as const,
});
