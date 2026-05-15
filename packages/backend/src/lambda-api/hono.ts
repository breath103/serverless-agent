import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import {
  clearSessionCookie,
  parseSessionCookie,
  resolveSession,
  setSessionCookie,
  signIn,
  signOut,
  signUp,
  UsernameTakenError,
} from "../auth/index.js";
import type { AppEnv } from "../lib/app-context.js";
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
const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(5).max(256),
});
const signupSchema = credentialsSchema.extend({
  name: z.string().trim().min(1).max(128),
});

app.post("/api/auth/sign-up", async (c) => {
  const parsed = signupSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new HTTPException(400, { message: "invalid_body" });
  try {
    const result = await signUp(parsed.data);
    setSessionCookie(c, result.sessionId, result.expiresAt);
    return c.json({ user: result.user });
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      throw new HTTPException(409, { message: "username_taken" });
    }
    throw err;
  }
});

app.post("/api/auth/sign-in", async (c) => {
  const parsed = credentialsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new HTTPException(400, { message: "invalid_body" });
  const result = await signIn(parsed.data);
  if (!result) throw new HTTPException(401, { message: "invalid_credentials" });
  setSessionCookie(c, result.sessionId, result.expiresAt);
  return c.json({ user: result.user });
});

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
