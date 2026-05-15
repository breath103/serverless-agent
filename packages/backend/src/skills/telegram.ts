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

export async function telegramSendMessage(token: string, chatId: string, text: string): Promise<void> {
  await callTelegram(token, "sendMessage", { chat_id: chatId, text }, z.object({}).passthrough());
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
