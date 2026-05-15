import { telegramSendMessage } from "../skills/telegram.js";
import { userSkillsRepo } from "../skills/user-skills-repository.js";

interface TelegramTarget {
  skillRowId: string;
  bot_token: string;
  telegram_chat_id: string;
}

async function resolveTelegramTargets(opts: { userId: string; sessionId: string }): Promise<TelegramTarget[]> {
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

/**
 * Per-turn dispatcher. Lazy on first call (avoids racing the webhook's
 * binding-write) and caches the row list (one DDB read per turn).
 * Per-target failures swallowed — broken bot must not crash the turn.
 */
export function createTelegramDispatcher(opts: { userId: string; sessionId: string }): (text: string) => Promise<void> {
  let targets: TelegramTarget[] | null = null;
  return async (text: string) => {
    targets ??= await resolveTelegramTargets(opts);
    for (const t of targets) {
      try {
        await telegramSendMessage(t.bot_token, t.telegram_chat_id, text);
      } catch (err) {
        console.error(
          `[telegram-dispatcher] skill=${t.skillRowId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  };
}
