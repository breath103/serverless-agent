#!/usr/bin/env -S node --import tsx
/**
 * End-to-end harness for the Telegram channel-style skill.
 *
 * Skipping real Telegram (we don't ship credentials), the harness spins up an
 * in-process mock that captures every Bot API call and points the in-process
 * helpers + dispatcher at it via `TELEGRAM_BOT_API_BASE`. The webhook route is
 * driven over real HTTP through the dev edge proxy — that path has no
 * outbound Telegram call, so the dev backend's view of `TELEGRAM_BOT_API_BASE`
 * doesn't matter for it.
 *
 * Preconditions:
 *   - `./scripts/dev.ts start` is running.
 *   - `npm run -w backend ddb:bootstrap` has seeded the `admin / admin` user.
 *
 * Run from repo root:  `./packages/backend/scripts/e2e_telegram.ts`
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { loadConfig } from "shared/config";

import { createTelegramDispatcher } from "../src/channels/telegram-dispatcher.js";
import { ddbTables } from "../src/lib/ddb.js";
import { taggedConfig } from "../src/skills/index.js";
import { TELEGRAM_SECRET_HEADER, telegramDeleteWebhook, telegramGetMe, telegramSendMessage, telegramSetWebhook } from "../src/skills/telegram.js";
import { assert, loginAsUser, waitFor } from "./lib/e2e.js";
import { loadEnv } from "./lib/env.js";

loadEnv("development");

const config = loadConfig();
const BASE = `http://localhost:${config.edge.devPort}`;

// eslint-disable-next-line @typescript-eslint/no-restricted-types -- captured wire payload; the test asserts on individual keys
type CapturedBody = Record<string, unknown>;
interface CapturedCall {
  method: string;
  body: CapturedBody;
}

function startMockTelegram(): Promise<{ server: Server; baseUrl: string; calls: CapturedCall[] }> {
  const calls: CapturedCall[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // URLs look like /bot<token>/<method>
    const match = /^\/bot[^/]+\/([^/?]+)/.exec(req.url ?? "");
    const method = match ? match[1] : "?";
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = (raw ? JSON.parse(raw) : {}) as CapturedBody;
      calls.push({ method, body });
      // Mirror real Telegram return shapes well enough that zod parses don't reject:
      //   getMe → User object, sendMessage → Message object, set/deleteWebhook → boolean.
      // eslint-disable-next-line @typescript-eslint/no-restricted-types -- mock-side wire result; shape varies per Telegram method
      let result: unknown;
      if (method === "getMe") result = { username: "mock_test_bot" };
      else if (method === "sendMessage") result = { message_id: 1 };
      else result = true;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, result }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}`, calls });
    });
  });
}

async function postWebhook(opts: {
  userId: string;
  userSkillId: string;
  secret: string;
  update: object;
}): Promise<Response> {
  return await fetch(`${BASE}/api/telegram/webhook/${opts.userId}/${opts.userSkillId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [TELEGRAM_SECRET_HEADER]: opts.secret,
    },
    body: JSON.stringify(opts.update),
  });
}

async function main(): Promise<void> {
  console.log("→ start mock Telegram server");
  const mock = await startMockTelegram();
  process.env.TELEGRAM_BOT_API_BASE = mock.baseUrl;

  try {
    console.log("→ helpers: getMe / setWebhook / deleteWebhook / sendMessage hit the mock");
    const me = await telegramGetMe("test-token");
    assert(me.bot_username === "mock_test_bot", "getMe returned wrong username");
    await telegramSetWebhook("test-token", "https://example.invalid/wh", "secret-xyz");
    await telegramSendMessage("test-token", "12345", "**bold** and `code` and a [link](https://example.com)\n- bullet one\n- bullet two");
    await telegramDeleteWebhook("test-token");

    const methodsSeen = mock.calls.map((c) => c.method);
    assert(methodsSeen.includes("getMe"), "mock didn't see getMe");
    assert(methodsSeen.includes("setWebhook"), "mock didn't see setWebhook");
    assert(methodsSeen.includes("sendMessage"), "mock didn't see sendMessage");
    assert(methodsSeen.includes("deleteWebhook"), "mock didn't see deleteWebhook");
    const setHook = mock.calls.find((c) => c.method === "setWebhook");
    assert(setHook?.body.secret_token === "secret-xyz", "setWebhook didn't pass secret_token");
    const sent = mock.calls.find((c) => c.method === "sendMessage");
    assert(sent?.body.parse_mode === "HTML", `sendMessage should request HTML parse_mode, got ${String(sent?.body.parse_mode)}`);
    const sentText = sent.body.text as string;
    assert(sentText.includes("<b>bold</b>"), `sendMessage didn't convert bold: ${sentText}`);
    assert(sentText.includes("<code>code</code>"), `sendMessage didn't convert inline code: ${sentText}`);
    assert(sentText.includes("<a href=\"https://example.com\">link</a>"), `sendMessage didn't convert link: ${sentText}`);
    assert(sentText.includes("• bullet one"), `sendMessage didn't convert bullets: ${sentText}`);

    console.log("→ sign in as admin");
    const cookie = await loginAsUser(BASE, "admin", "admin");
    const me2 = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookie } });
    const session = await me2.json() as { user: { id: string } };
    const userId = session.user.id;

    console.log("→ inject synthetic telegram skill row (chat unbound)");
    const userSkillId = randomUUID();
    const webhookSecret = randomBytes(16).toString("hex");
    const now = new Date().toISOString();
    await ddbTables.userSkills.put({
      user_id: userId,
      id: userSkillId,
      data: taggedConfig("telegram", {
        bot_token: "test-token",
        telegram_chat_id: null,
        chat_session_id: null,
        webhook_secret: webhookSecret,
        bot_username: "mock_test_bot",
      }),
      created_at: now,
      updated_at: now,
    });

    console.log("→ inbound webhook: missing secret → 401");
    const noSecret = await fetch(`${BASE}/api/telegram/webhook/${userId}/${userSkillId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ update_id: 1, message: { chat: { id: 555, type: "private" }, text: "hi" } }),
    });
    assert(noSecret.status === 401, `expected 401 for missing secret, got ${noSecret.status}`);

    console.log("→ inbound webhook: wrong secret → 401");
    const badSecret = await postWebhook({
      userId,
      userSkillId,
      secret: "nope",
      update: { update_id: 2, message: { chat: { id: 555, type: "private" }, text: "hi" } },
    });
    assert(badSecret.status === 401, `expected 401 for bad secret, got ${badSecret.status}`);

    console.log("→ inbound webhook: text → creates chat session and binds the row");
    const goodOne = await postWebhook({
      userId,
      userSkillId,
      secret: webhookSecret,
      update: { update_id: 3, message: { chat: { id: 555, type: "private" }, text: "hi from telegram" } },
    });
    if (!goodOne.ok) throw new Error(`expected 200 for valid webhook, got ${goodOne.status}: ${await goodOne.text()}`);

    // Confirm binding lives on the skill row, not on the chat session itself.
    const reread = await ddbTables.userSkills.get({ user_id: userId, id: userSkillId });
    assert(reread?.data.skill_id === "telegram", "skill row vanished");
    assert(reread.data.config.telegram_chat_id === "555", `telegram_chat_id not bound: ${String(reread.data.config.telegram_chat_id)}`);
    const sessionId = reread.data.config.chat_session_id;
    assert(typeof sessionId === "string" && sessionId.length > 0, "chat_session_id not set on first inbound");

    console.log("→ messages row exists with the inbound text");
    const messages = await fetch(`${BASE}/api/chat/${sessionId}/messages`, { headers: { Cookie: cookie } });
    if (!messages.ok) throw new Error(`messages fetch failed: ${messages.status} ${await messages.text()}`);
    const rows = await messages.json() as { data: { role: string; content: { kind: string; text: string } } }[];
    const first = rows.find((r) => r.data.role === "user");
    assert(first?.data.content.text === "hi from telegram", `wrong user message: ${first?.data.content.text ?? "(missing)"}`);

    console.log("→ inbound webhook: photo-only update inserts placeholder text");
    // Wait briefly for the in-flight chat turn to finish so the next inbound
    // isn't dropped as "busy". The agent may legitimately fail (no anthropic
    // key, fake model) but the lifecycle still flips is_generating back to
    // false in finally{}.
    await waitForIdle({ cookie, sessionId, ms: 8000 });
    const photoUpdate = await postWebhook({
      userId,
      userSkillId,
      secret: webhookSecret,
      update: { update_id: 4, message: { chat: { id: 555, type: "private" }, photo: [{ file_id: "ABC" }] } },
    });
    assert(photoUpdate.ok, `photo webhook failed: ${photoUpdate.status}`);
    await waitFor(() => fetch(`${BASE}/api/chat/${sessionId}/messages`, { headers: { Cookie: cookie } })
      .then(async (r) => (await r.json() as { data: { role: string; content: { kind: string; text: string } } }[]))
      .then((rs) => rs.some((r) => r.data.role === "user" && r.data.content.text === "[image] - not supported yet")));

    console.log("→ inbound webhook: group chat → ignored");
    const lenBefore = (await fetch(`${BASE}/api/chat/${sessionId}/messages`, { headers: { Cookie: cookie } })
      .then(async (r) => (await r.json() as { id: string }[]))).length;
    const groupUpdate = await postWebhook({
      userId,
      userSkillId,
      secret: webhookSecret,
      update: { update_id: 5, message: { chat: { id: 999, type: "group" }, text: "should be ignored" } },
    });
    assert(groupUpdate.ok, `group webhook should 200 (ignored), got ${groupUpdate.status}`);
    const lenAfter = (await fetch(`${BASE}/api/chat/${sessionId}/messages`, { headers: { Cookie: cookie } })
      .then(async (r) => (await r.json() as { id: string }[]))).length;
    assert(lenBefore === lenAfter, "group-chat update unexpectedly inserted a message");

    console.log("→ outbound dispatcher: fires sendMessage at the bound chat");
    const callsBefore = mock.calls.filter((c) => c.method === "sendMessage").length;
    const dispatch = createTelegramDispatcher({ userId, sessionId });
    await dispatch("reply from agent");
    const callsAfter = mock.calls.filter((c) => c.method === "sendMessage").length;
    assert(callsAfter === callsBefore + 1, `dispatcher should have sent 1 message, sent ${callsAfter - callsBefore}`);
    const lastSend = mock.calls.filter((c) => c.method === "sendMessage").at(-1);
    assert(lastSend?.body.chat_id === "555", `dispatcher used wrong chat_id: ${String(lastSend?.body.chat_id)}`);
    // Lazy cache check — a second call shouldn't trigger a fresh DDB read but
    // should still send. We can't observe the DDB read count from here, but
    // we can at least confirm both sends land.
    await dispatch("another reply");
    assert(mock.calls.filter((c) => c.method === "sendMessage").length === callsAfter + 1, "second dispatch didn't land");

    console.log("→ outbound dispatcher: unrelated session → no send");
    const beforeNoSend = mock.calls.filter((c) => c.method === "sendMessage").length;
    const noneDispatch = createTelegramDispatcher({ userId, sessionId: randomUUID() });
    await noneDispatch("should not fire");
    assert(mock.calls.filter((c) => c.method === "sendMessage").length === beforeNoSend, "dispatcher fired for unbound session");

    // Note: the DELETE handler runs inside the dev-backend process, which
    // doesn't inherit our TELEGRAM_BOT_API_BASE override — the real
    // `deleteWebhook` call hits api.telegram.org with the fake token and
    // the route's .catch swallows the 4xx. So we only assert the row gets
    // removed; the helper itself is covered by the in-process call above.
    console.log("→ DELETE /api/skills/:id → row gone");
    const del = await fetch(`${BASE}/api/skills/${userSkillId}`, { method: "DELETE", headers: { Cookie: cookie } });
    if (!del.ok) throw new Error(`delete failed: ${del.status} ${await del.text()}`);
    const gone = await ddbTables.userSkills.get({ user_id: userId, id: userSkillId });
    assert(gone === null, "skill row should be deleted");

    console.log("\n✅ e2e_telegram passed");
  } finally {
    mock.server.close();
  }
}

async function waitForIdle(opts: { cookie: string; sessionId: string; ms: number }): Promise<void> {
  await waitFor(async () => {
    const res = await fetch(`${BASE}/api/chat/${opts.sessionId}`, { headers: { Cookie: opts.cookie } });
    const row = await res.json() as { is_generating: boolean };
    return !row.is_generating;
  }, opts.ms).catch(() => {});
}

main().catch((err) => {
  console.error("\n❌ e2e_telegram failed:");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
