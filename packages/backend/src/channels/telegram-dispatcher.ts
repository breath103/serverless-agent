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
 * Build a per-turn dispatcher. Resolves bound Telegram targets lazily on
 * first call and caches them — DDB read happens at most once per turn,
 * after the inbound webhook has had time to write the binding (no race).
 * Per-target send failures are swallowed (web-UI already delivered).
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
