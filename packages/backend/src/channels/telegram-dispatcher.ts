import { telegramSendMessage } from "../skills/telegram.js";
import { userSkillsRepo } from "../skills/user-skills-repository.js";

export interface TelegramTarget {
  skillRowId: string;
  bot_token: string;
  telegram_chat_id: string;
}

/** Call once per chat turn — the binding doesn't change mid-turn. */
export async function resolveTelegramTargets(opts: { userId: string; sessionId: string }): Promise<TelegramTarget[]> {
  const rows = await userSkillsRepo.listForUser(opts.userId);
  const targets: TelegramTarget[] = [];
  for (const row of rows) {
    if (row.data.skill_id !== "telegram") continue;
    const { bot_token, telegram_chat_id, chat_session_id } = row.data.config;
    if (telegram_chat_id === null || chat_session_id !== opts.sessionId) continue;
    targets.push({ skillRowId: row.id, bot_token, telegram_chat_id });
  }
  return targets;
}

/** Per-target failures are swallowed — web-UI already delivered; a broken bot mustn't crash the turn. */
export async function dispatchTextToTelegram(targets: TelegramTarget[], text: string): Promise<void> {
  for (const t of targets) {
    try {
      await telegramSendMessage(t.bot_token, t.telegram_chat_id, text);
    } catch (err) {
      console.error(
        `[telegram-dispatcher] skill=${t.skillRowId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
