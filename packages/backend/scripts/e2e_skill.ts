#!/usr/bin/env -S node --import tsx
/**
 * End-to-end harness for the skill installation flow. Drives every write
 * boundary of the `/api/skills/*` route family + the DDB `user-skills`
 * repository, in the same shape a real user-driven OAuth connect would
 * exercise — minus the actual Google round-trip (we synthesise the row
 * directly, since real OAuth needs a Google-signed code).
 *
 * Preconditions:
 *   - `./scripts/dev.ts start` is running (edge + backend + ddb-local up).
 *   - `npm run -w backend ddb:bootstrap` has seeded the `admin / admin` user.
 *
 * Run from repo root:  `./packages/backend/scripts/e2e_skill.ts`
 *
 * Exits 0 on success, non-zero on the first failing assertion.
 */
import { randomUUID } from "node:crypto";

import { loadConfig } from "shared/config";

import { ddbTables } from "../src/lib/ddb.js";
import { refreshAllUserSkills } from "../src/worker/refresh-user-skills.js";
import { DEV_ADMIN_USER_ID, devSignIn } from "./lib/dev-auth.js";
import { loadEnv } from "./lib/env.js";

loadEnv("development");

const config = loadConfig();
const BASE = `http://localhost:${config.edge.devPort}`;

// eslint-disable-next-line @typescript-eslint/no-restricted-types -- assertion helper accepts any truthy/falsy
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function api<T>(cookie: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Cookie": cookie, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);

  return await res.json() as T;
}

async function main(): Promise<void> {
  console.log("→ sign in as dev-admin (direct session creation)");
  const cookie = await devSignIn(DEV_ADMIN_USER_ID);

  console.log("→ GET /api/skills/installed (initial)");
  const initial = await api<{ id: string }[]>(cookie, "/api/skills/installed");
  console.log(`   ${initial.length} already installed`);

  console.log("→ POST /api/skills/install/oauth/redirect (verify URL shape)");
  const redirect = await api<{ redirectUrl: string }>(cookie, "/api/skills/install/oauth/redirect", {
    method: "POST",
    body: JSON.stringify({ skillId: "google-calendar" }),
  });
  const url = new URL(redirect.redirectUrl);
  assert(url.host === "accounts.google.com", "redirect host is not Google");
  assert(url.pathname === "/o/oauth2/v2/auth", "redirect path is not OAuth2 auth");
  assert(url.searchParams.get("response_type") === "code", "missing response_type=code");
  assert(url.searchParams.get("access_type") === "offline", "missing access_type=offline (refresh_token won't be issued)");
  assert(url.searchParams.get("prompt") === "consent", "missing prompt=consent (refresh_token re-issue on reconnect)");
  assert(
    url.searchParams.get("redirect_uri")?.endsWith("/api/skills/oauth/callback"),
    "redirect_uri doesn't point at /api/skills/oauth/callback",
  );
  const scopes = (url.searchParams.get("scope") ?? "").split(" ");
  assert(scopes.includes("https://www.googleapis.com/auth/calendar"), "missing calendar scope");
  assert(scopes.includes("openid") && scopes.includes("email") && scopes.includes("profile"), "missing openid/email/profile scopes");

  const state = url.searchParams.get("state");
  assert(state, "missing state in redirect URL");

  const decoded = JSON.parse(Buffer.from(state, "base64url").toString()) as { skillId: string; userId: string };
  assert(decoded.skillId === "google-calendar", "state has wrong skillId");
  assert(typeof decoded.userId === "string" && decoded.userId.length > 0, "state has no userId");

  // Real OAuth callback needs a Google-signed `code`. To exercise the list +
  // delete + dedup paths, inject a synthetic user_skill row directly.
  console.log("→ inject synthetic user_skill row");
  const syntheticId = randomUUID();
  const now = new Date().toISOString();
  await ddbTables.userSkills.put({
    user_id: decoded.userId,
    id: syntheticId,
    data: {
      skill_id: "google-calendar",
      config: {
        accessToken: "ya29.fake-access-token",
        refreshToken: "1//fake-refresh-token",
        // Past expiry → refreshAllUserSkills() will actually attempt a
        // refresh against Google (which fails on placeholder creds), so
        // the worker's failure-counting path gets exercised.
        expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
        email: "admin@example.invalid",
        name: "Admin Tester",
      },
    },
    created_at: now,
    updated_at: now,
  });

  console.log("→ GET /api/skills/installed (should include synthetic row)");
  const listed = await api<{ id: string; data: { skill_id: string } }[]>(cookie, "/api/skills/installed");
  const found = listed.find((r) => r.id === syntheticId);
  assert(found, `installed list missing synthetic row ${syntheticId}`);
  assert(found.data.skill_id === "google-calendar", "synthetic row has wrong skill_id");

  // Exercise the cron worker in-process. Fake refresh_token + placeholder
  // OAuth client guarantee the refresh call fails — we assert the worker
  // counts the failure, doesn't throw, and leaves the row in place.
  console.log("→ refreshAllUserSkills() — failing refresh should be logged + counted, row preserved");
  const stats = await refreshAllUserSkills();
  assert(stats.scanned >= 1, `worker should have scanned ≥1 row, got ${stats.scanned}`);
  assert(stats.failed >= 1, `worker should have counted ≥1 failed refresh (fake refresh_token), got ${stats.failed}`);
  const stillThere = await api<{ id: string }[]>(cookie, "/api/skills/installed");
  assert(stillThere.some((r) => r.id === syntheticId), "row was deleted by refresh worker (should be preserved on failure)");

  console.log("→ DELETE /api/skills/:id");
  const uninstalled = await api<{ uninstalled: boolean }>(cookie, `/api/skills/${syntheticId}`, { method: "DELETE" });
  assert(uninstalled.uninstalled === true, "uninstall response shape wrong");

  console.log("→ GET /api/skills/installed (synthetic row should be gone)");
  const after = await api<{ id: string }[]>(cookie, "/api/skills/installed");
  assert(!after.some((r) => r.id === syntheticId), "synthetic row still present after DELETE");
  assert(after.length === initial.length, `installed count drifted: ${initial.length} → ${after.length}`);

  console.log("→ DELETE /api/skills/:id on a non-existent row (404)");
  const res = await fetch(`${BASE}/api/skills/${randomUUID()}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  assert(res.status === 404, `expected 404 for missing skill, got ${res.status}`);

  console.log("\n✅ e2e_skill passed");
}

main().catch((err) => {
  console.error("\n❌ e2e_skill failed:");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
