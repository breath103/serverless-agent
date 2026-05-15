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
 * Send a message to a Telegram chat. The agent emits Markdown; Telegram only
 * renders MarkdownV2 (finicky) or a small HTML subset. We convert to that HTML
 * subset and try `parse_mode: "HTML"`; if Telegram rejects (parse error), we
 * fall back to the raw text without `parse_mode` so the user still sees the
 * content, just unformatted.
 */
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

/**
 * Convert agent-emitted Markdown to Telegram's tiny HTML subset:
 * <b>, <i>, <u>, <s>, <code>, <pre>, <a href>. Tables get flattened to
 * `·`-separated cells. Headers collapse to <b>. Lists keep their leading
 * bullet/number as plain text. Anything else passes through with HTML
 * specials (`&`, `<`, `>`) escaped — otherwise an LLM-emitted `<x>` would
 * be parsed by Telegram as a (broken) tag.
 */
function markdownToTelegramHtml(md: string): string {
  let html = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Table separator row, e.g. `|---|---|`. Drop entirely.
  html = html.replace(/^\s*\|\s*[-:]+(\s*\|\s*[-:]+)*\s*\|\s*$/gm, "");
  // Remaining `| a | b | c |` rows → "a · b · c".
  html = html.replace(/^\s*\|(.+)\|\s*$/gm, (_, inner: string) =>
    inner.split("|").map((c) => c.trim()).filter((c) => c.length > 0).join(" · "),
  );

  // Fenced code → <pre>…</pre>. Strip a language tag if present.
  html = html.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (_, body: string) => `<pre>${body.replace(/\n$/, "")}</pre>`);
  // Inline code → <code>…</code>.
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Bold first, then italic — order matters so `**` is consumed before `*`.
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  html = html.replace(/__([^_\n]+)__/g, "<b>$1</b>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");
  html = html.replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<i>$2</i>");
  html = html.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");

  // Links — escape the URL's `"` to avoid breaking the href attribute.
  html = html.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_, label: string, href: string) =>
    `<a href="${href.replace(/"/g, "&quot;")}">${label}</a>`,
  );

  // Headers → bold + newline.
  html = html.replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, "<b>$1</b>");
  // Horizontal rules → a divider character.
  html = html.replace(/^\s{0,3}[-*_]{3,}\s*$/gm, "—");
  // Bullet list markers → "• ".
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
