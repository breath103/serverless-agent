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
  try {
    await callTelegram(token, "sendMessage", {
      chat_id: chatId,
      text: markdownToTelegramHtml(text),
      parse_mode: "HTML",
    }, z.object({}).passthrough());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("parse")) throw err;
    await callTelegram(token, "sendMessage", { chat_id: chatId, text }, z.object({}).passthrough());
  }
}

/** Markdown → Telegram HTML subset. `<>&` escaped first so LLM-emitted angle brackets don't parse as tags. Tables flatten; Telegram has no table support. */
function markdownToTelegramHtml(md: string): string {
  let html = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  html = html.replace(/^\s*\|\s*[-:]+(\s*\|\s*[-:]+)*\s*\|\s*$/gm, "");
  html = html.replace(/^\s*\|(.+)\|\s*$/gm, (_, inner: string) =>
    inner.split("|").map((c) => c.trim()).filter((c) => c.length > 0).join(" · "),
  );

  html = html.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (_, body: string) => `<pre>${body.replace(/\n$/, "")}</pre>`);
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Bold before italic — otherwise the italic regex eats one `*` from each `**`.
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  html = html.replace(/__([^_\n]+)__/g, "<b>$1</b>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");
  html = html.replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<i>$2</i>");
  html = html.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");

  html = html.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_, label: string, href: string) =>
    `<a href="${href.replace(/"/g, "&quot;")}">${label}</a>`,
  );

  html = html.replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, "<b>$1</b>");
  html = html.replace(/^\s{0,3}[-*_]{3,}\s*$/gm, "—");
  html = html.replace(/^(\s*)[-*+]\s+/gm, "$1• ");

  return html;
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
