import { chatSessionsRepo } from "../chat-sessions/chat-sessions-repository.js";
import { publishRealtimeEvent } from "../lib/realtime-publish.js";
import { BEDROCK_MODEL, bedrockClient } from "./bedrock-client.js";

const SYSTEM_PROMPT = `You label chat threads with a short, specific title.

Rules:
- Output JUST the title — no quotes, no trailing punctuation, no explanation
- **Write the title in the SAME LANGUAGE as the user's message.** Korean in → Korean out. English in → English out. Never translate.
- 3–6 words (or ~10–20 characters for CJK languages)
- For English, use Title Case. For Korean/Japanese/Chinese, use the natural form — do not force capitalization or word-splitting conventions from English.
- Capture the topic, not the question form.
  - "Do I know any company that had issue with SOC2?" → "Companies With SOC2 Issues"
  - "이동현 대표 최근에 이탈률 얘기 몇 번 했어?" → "이동현 이탈률 언급 빈도"
- No filler words ("chat about", "discussion of", "thoughts on", "~에 대해"). Just the subject.`;

/**
 * Fire-and-forget title generation for a chat session.
 *
 * Caller invokes this in the background when a new chat's first user message
 * arrives. Generates a short title via haiku, writes it to the row, then
 * broadcasts an entity_update event so the client's chat list updates live.
 *
 * Errors are swallowed (logged) — title is cosmetic, never block the turn.
 */
export async function generateChatTitleInBackground(opts: {
  userId: string;
  sessionId: string;
  userMessageText: string;
}): Promise<void> {
  try {
    const title = await generateTitle(opts.userMessageText);
    const updated = await chatSessionsRepo.updateTitle(opts.userId, opts.sessionId, title);
    if (!updated) return;
    await publishRealtimeEvent(opts.userId, {
      type: "entity_update",
      table: "chat_sessions",
      op: "upsert",
      row: updated,
    });
  } catch (err) {
    console.error("[title-gen] failed", err);
  }
}

async function generateTitle(userMessageText: string): Promise<string> {
  const response = await bedrockClient.messages.create({
    model: BEDROCK_MODEL,
    max_tokens: 64,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessageText }],
  });
  const block = response.content[0];
  if (block.type !== "text") throw new Error("title-gen: no text block");
  return block.text.trim().replace(/^["']|["']$/g, "").replace(/[.!?]+$/, "");
}
