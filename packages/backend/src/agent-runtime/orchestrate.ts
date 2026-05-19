import { createTelegramDispatcher } from "../channels/telegram-dispatcher.js";
import { chatSessionsRepo } from "../chat-sessions/chat-sessions-repository.js";
import type { ChatSessionMessageData } from "../lib/realtime-events.js";
import { publishRealtimeEvent } from "../lib/realtime-publish.js";
import { profilesRepo } from "../profiles/profiles-repository.js";
import type { ProfileRow } from "../types/database.js";
import { chat } from "./anthropic.js";
import { CodeExecutor } from "./code-executor.js";
import { rowsToLlmMessages } from "./convert.js";
import { TypescriptDeclarations } from "./declarations.js";
import type { LlmAssistantContentBlock, LlmMessage, LlmUserContentBlock } from "./llm-message.js";
import { buildSkills } from "./skills.js";
import { executeCodeTool, toolDefinitionsForLlm } from "./tools.js";
import { TypeChecker } from "./type-checker.js";
import type { SkillCall } from "./types.js";

const MAX_TURN_STEPS = 10;

/**
 * Run one chat turn: load history → loop (LLM ↔ tool) → emit each part as
 * its own chat_session_messages row with matching MQTT publish.
 *
 * Any thrown error gets surfaced as a `kind: "error"` row so the UI shows
 * the failure instead of just "stuck".
 */
export async function runChatTurn(opts: {
  userId: string;
  sessionId: string;
}): Promise<void> {
  const { userId, sessionId } = opts;

  // skillCalls for the NEXT executeCode run are pushed here via skill proxies.
  // Reset before each tool invocation so each tool_result carries only its own.
  const skillCallBuffer: SkillCall[] = [];
  const skills = await buildSkills({
    userId,
    skillCalls: skillCallBuffer,
  });

  const declarations = new TypescriptDeclarations(skills.declarations);
  const typeChecker = new TypeChecker(declarations.declarations);
  const codeExecutor = new CodeExecutor(typeChecker);

  const profile = await loadProfile(userId);
  const systemPrompt = buildSystemPrompt(declarations.declarations, profile);
  const tools = toolDefinitionsForLlm();

  const initialRows = await chatSessionsRepo.listMessagesAsc(sessionId);
  const history: LlmMessage[] = rowsToLlmMessages(initialRows);
  annotateLastUserMessageWithTime(history, profile?.timezone);

  const sendToTelegram = createTelegramDispatcher({ userId, sessionId });

  try {
    for (let step = 0; step < MAX_TURN_STEPS; step += 1) {
      const message = await chat({
        system: systemPrompt,
        messages: history,
        tools,
      });

      for (const block of message.content) {
        await persistAssistantBlock({ userId, sessionId, block, sendToTelegram });
      }
      history.push({ role: "assistant", content: message.content });

      const toolUses = message.content.flatMap((b) => (b.type === "tool_use" ? [b] : []));
      if (toolUses.length === 0) break;

      const toolResultBlocks: LlmUserContentBlock[] = [];
      for (const toolUse of toolUses) {
        skillCallBuffer.length = 0;
        const result = await codeExecutor.execute({
          code: toolUse.input.code,
          skills: skills.bindings,
          skillCalls: skillCallBuffer,
        });

        await insertPart({
          userId,
          sessionId,
          data: {
            role: "assistant",
            content: {
              kind: "tool_result",
              tool_call_id: toolUse.id,
              reads: result.data.reads,
              skillCalls: result.data.skillCalls,
              ...(result.type === "failure" ? { error: result.data.error } : {}),
            },
          },
        });

        // Feed LLM only `reads` (+ error). skillCalls are never sent back.
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          result: result.type === "success"
            ? { reads: result.data.reads }
            : { reads: result.data.reads, error: result.data.error },
        });
      }
      history.push({ role: "user", content: toolResultBlocks });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat] turn failed:", err);
    await insertPart({
      userId,
      sessionId,
      data: { role: "assistant", content: { kind: "error", message } },
    });
    throw err;
  }
}

type ProfileInfo = Pick<ProfileRow, "name" | "language" | "timezone" | "about"> | null;

async function loadProfile(userId: string): Promise<ProfileInfo> {
  const data = await profilesRepo.getByUserId(userId);
  if (!data) return null;
  return { name: data.name, language: data.language, timezone: data.timezone, about: data.about };
}

async function persistAssistantBlock(opts: {
  userId: string;
  sessionId: string;
  block: LlmAssistantContentBlock;
  sendToTelegram: (text: string) => Promise<void>;
}): Promise<void> {
  const { userId, sessionId, block, sendToTelegram } = opts;

  switch (block.type) {
    case "text": {
      await insertPart({
        userId,
        sessionId,
        data: { role: "assistant", content: { kind: "text", text: block.text } },
      });
      await sendToTelegram(block.text);
      break;
    }
    case "tool_use": {
      await insertPart({
        userId,
        sessionId,
        data: {
          role: "assistant",
          content: {
            kind: "tool_call",
            tool_call_id: block.id,
            name: executeCodeTool.name,
            input: block.input,
          },
        },
      });
      if (block.input.description.length > 0) {
        await sendToTelegram(`_${block.input.description}…_`);
      }
      break;
    }
  }
}

async function insertPart(opts: {
  userId: string;
  sessionId: string;
  data: ChatSessionMessageData;
}): Promise<void> {
  const row = await chatSessionsRepo.insertMessage(opts.sessionId, opts.data);
  await publishRealtimeEvent(opts.userId, { type: "entity_update", table: "chat_session_messages", op: "upsert", row });
}

function buildSystemPrompt(declarations: string[], profile: ProfileInfo): string {
  return [
    "You are a helpful assistant. Respond in markdown. Keep messages concise.",
    ...profileLines(profile),
    "",
    "You have one tool: `executeCode`, which runs TypeScript in a sandbox.",
    "Use it to call skills (e.g. `memory.search(...)`, `webSearch.search(...)`),",
    "do computation, or anything that needs a real result. For pure conversational",
    "replies, just respond in text.",
    "",
    "Available in the sandbox:",
    "```typescript",
    declarations.join("\n\n"),
    "```",
    "",
    "Use `read(value)` inside code to surface values back to yourself for inspection.",
    "",
    "Linking resources: whenever your reply mentions a memory you just looked up,",
    "link it with a `app://` markdown link so the user can hover-preview and click",
    "through to dig in. Prefer linking over plain bold/italic whenever the ID is",
    "available.",
    "",
    "- Memory:  `[title](app://memories/<memory-id>)`",
    "",
    "Use the exact `id` from the skill output. Never invent IDs.",
  ].join("\n");
}

/**
 * Append a `[now: ...]` hint to the most recent *user-authored* message so the
 * LLM can resolve relative time references ("tomorrow", "last week") against
 * the user's wall clock. Tool-result messages are skipped — only real user
 * text gets the hint, and only once per turn.
 */
function annotateLastUserMessageWithTime(history: LlmMessage[], timezone: string | undefined) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg.role !== "user") continue;
    const hasText = msg.content.some((c) => c.type === "text");
    if (!hasText) continue;
    msg.content.push({ type: "text", text: `[now: ${formatNowForUser(timezone)}]` });
    return;
  }
}

function formatNowForUser(timezone: string | undefined) {
  const now = new Date();
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(now);
  } catch {
    return now.toISOString();
  }
}

function profileLines(profile: ProfileInfo) {
  if (!profile) return [];
  const lines = [
    "",
    "You're talking to:",
    `- Name: ${profile.name}`,
    `- Language: ${profile.language} (reply in this language unless the user switches; ALSO use this language for the \`executeCode\` tool's \`description\` field — never default that to English when the user is non-English)`,
    `- Timezone: ${profile.timezone}`,
  ];
  if (profile.about.trim()) {
    lines.push("- About:");
    profile.about.split("\n").forEach((line) => lines.push(`  ${line}`));
  }
  return lines;
}
