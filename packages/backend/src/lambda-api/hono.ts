import { randomBytes } from "node:crypto";

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { registerGoogleOAuthRoutes } from "../auth/google-oauth-routes.js";
import {
  clearSessionCookie,
  parseSessionCookie,
  resolveSession,
  SESSION_TTL_MS,
  setSessionCookie,
  signOut,
} from "../auth/index.js";
import { sessionsRepo } from "../auth/sessions-repository.js";
import type { AppEnv } from "../lib/app-context.js";
import { ddbTables } from "../lib/ddb.js";
import { warning } from "../lib/developer-warning.js";
import { registerToHono } from "../lib/hono-adapter.js";
import { telemetry } from "../lib/telemetry.js";
import { api } from "./routes/index.js";

const app = new Hono<AppEnv>();

// Global error handler — all non-HTTPException errors are 500
app.onError((err, c) => {
  console.error(`[error] ${c.req.method} ${c.req.path}`, err);
  warning.send("api-handler", () => ({ method: c.req.method, path: c.req.path, error: err.message }));

  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  } else {
    return c.json({ error: err.message }, 500);
  }
});

// Telemetry: wrap each request in a root trace span
if (telemetry) {
  const t = telemetry;
  app.use("*", async (c, next) => {
    await t.trace(`${c.req.method} ${c.req.routePath}`, async (span) => {
      span.setAttributes({ "http.method": c.req.method, "http.path": c.req.path });
      await next();
      span.setAttribute("http.status_code", c.res.status);
    });
  });
}

// ── Auth endpoints ────────────────────────────────────────────────────
registerGoogleOAuthRoutes(app);

// Dev-only: sign in as the seeded dev-admin user without going through Google.
// Used by ./scripts/e2e.ts login for headless browser automation.
if (process.env.NODE_ENV === "development") {
  app.post("/api/auth/dev-login", async (c) => {
    const sessionId = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await sessionsRepo.create({ id: sessionId, userId: "dev-admin", expiresAt });
    setSessionCookie(c, sessionId, expiresAt);
    return c.json({ ok: true });
  });

  // Dev-only: set the dev-admin user's credit balance. Used by the
  // out-of-credit e2e scenario to drain credits before driving the UI and
  // restore them in the cleanup block.
  app.post("/api/dev/set-credits", async (c) => {
    // eslint-disable-next-line @typescript-eslint/no-restricted-types -- untyped JSON body, narrowed below
    const body = await c.req.json().catch(() => ({})) as { credits?: unknown };
    if (typeof body.credits !== "number") throw new HTTPException(400, { message: "credits_must_be_number" });
    await ddbTables.users.update({
      key: { id: "dev-admin" },
      updateExpression: "SET credits = :c, updated_at = :u",
      expressionAttributeValues: { ":c": body.credits, ":u": new Date().toISOString() },
    });
    return c.json({ ok: true, credits: body.credits });
  });
}

app.post("/api/auth/sign-out", async (c) => {
  const sessionId = parseSessionCookie(c.req.header("cookie"));
  if (sessionId) await signOut(sessionId);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

app.get("/api/auth/session", async (c) => {
  const sessionId = parseSessionCookie(c.req.header("cookie"));
  if (!sessionId) return c.json({ user: null });
  const user = await resolveSession(sessionId);
  return c.json({ user });
});

// Auth middleware — populates c.user / c.sessionId for downstream routes.
app.use("*", async (c, next) => {
  c.set("user", null);
  c.set("sessionId", null);
  c.set("requireUser", () => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Unauthorized" });
    return user;
  });

  const sessionId = parseSessionCookie(c.req.header("cookie"));
  if (sessionId) {
    const user = await resolveSession(sessionId);
    if (user) {
      c.set("user", user);
      c.set("sessionId", sessionId);
    }
  }

  await next();
});

// Register all API routes
registerToHono(app, api);

export { app };
