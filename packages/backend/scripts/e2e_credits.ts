#!/usr/bin/env -S node --import tsx
/**
 * End-to-end harness for the chat-credit system. Exercises:
 *   1. Sequential drain via `usersRepo.decrementCredits`
 *   2. Race safety — two concurrent decrements at credits=1 → exactly one wins
 *   3. HTTP-layer 402 — `POST /api/chat` returns 402 when credits exhausted
 *
 * Preconditions:
 *   - `./scripts/dev.ts start` is running (edge + backend + ddb-local up).
 *   - `npm run -w backend ddb:reset` has run recently.
 *
 * Run from repo root:  `./packages/backend/scripts/e2e_credits.ts`
 *
 * Exits 0 on success, non-zero on first failing assertion.
 */
import { randomUUID } from "node:crypto";

import { loadConfig } from "shared/config";

import { ddbTables } from "../src/lib/ddb.js";
import { usersRepo } from "../src/users/users-repository.js";
import { devSignIn } from "./lib/dev-auth.js";
import { loadEnv } from "./lib/env.js";

loadEnv("development");

const config = loadConfig();
const BASE = `http://localhost:${config.edge.devPort}`;

// eslint-disable-next-line @typescript-eslint/no-restricted-types
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function seedUser(credits: number): Promise<string> {
  const id = `e2e-credits-${randomUUID()}`;
  const now = new Date().toISOString();
  await ddbTables.users.put({
    id,
    name: "Credits Test",
    credits,
    created_at: now,
    updated_at: now,
  });
  // resolveSession joins the user's accounts row for the email. Without it
  // the auth middleware returns null and routes 401 — seed a matching row.
  await ddbTables.accounts.put({
    user_id: id,
    provider: "google",
    sub: id,
    email: `${id}@example.invalid`,
    email_verified: true,
    created_at: now,
    updated_at: now,
  });
  return id;
}

async function main(): Promise<void> {
  console.log("→ seed user with credits=2");
  const seqUserId = await seedUser(2);

  console.log("→ sequential drain: 2 → 1 → 0 → null");
  const first = await usersRepo.decrementCredits(seqUserId);
  assert(first?.credits === 1, `expected credits=1, got ${first?.credits}`);
  const second = await usersRepo.decrementCredits(seqUserId);
  assert(second?.credits === 0, `expected credits=0, got ${second?.credits}`);
  const third = await usersRepo.decrementCredits(seqUserId);
  assert(third === null, `expected null at credits=0, got ${JSON.stringify(third)}`);
  console.log("   ✓ drained cleanly, null on exhaustion");

  console.log("→ race: 2 concurrent decrements at credits=1 → exactly one wins");
  const raceUserId = await seedUser(1);
  const [a, b] = await Promise.all([
    usersRepo.decrementCredits(raceUserId),
    usersRepo.decrementCredits(raceUserId),
  ]);
  const winners = [a, b].filter((r) => r !== null);
  const losers = [a, b].filter((r) => r === null);
  assert(winners.length === 1, `expected exactly 1 winner, got ${winners.length}`);
  assert(losers.length === 1, `expected exactly 1 loser, got ${losers.length}`);
  const finalRow = await ddbTables.users.get({ id: raceUserId });
  assert(finalRow?.credits === 0, `expected credits=0 after race, got ${finalRow?.credits}`);
  console.log("   ✓ race-safe, no negative credits");

  console.log("→ HTTP: POST /api/chat with credits=0 → 402 out_of_credit");
  const httpUserId = await seedUser(0);
  const cookie = await devSignIn(httpUserId);
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Cookie": cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ message: "should be rejected" }),
  });
  assert(res.status === 402, `expected 402, got ${res.status}`);
  const body = await res.json() as { error: string };
  assert(body.error === "out_of_credit", `expected out_of_credit, got ${body.error}`);
  console.log("   ✓ 402 out_of_credit");

  console.log("→ HTTP: POST /api/chat with credits=1 → 200, credits goes to 0");
  const okUserId = await seedUser(1);
  const okCookie = await devSignIn(okUserId);
  const okRes = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Cookie": okCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ message: "should succeed" }),
  });
  assert(okRes.ok, `expected 200, got ${okRes.status}: ${await okRes.text()}`);
  const okRow = await ddbTables.users.get({ id: okUserId });
  assert(okRow?.credits === 0, `expected credits=0 after one send, got ${okRow?.credits}`);
  console.log("   ✓ send succeeded, credit deducted");

  console.log("\n✅ all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
