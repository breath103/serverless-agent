import { randomBytes } from "node:crypto";

import type { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";

import { type AppEnv, edgeUrl } from "../lib/app-context.js";
import {
  buildOAuth2AuthUrl,
  defaultGoogleOAuthConfig,
  exchangeOAuth2Code,
  fetchGoogleUserInfo,
} from "../lib/google-oauth.js";
import { isRequestSecure, setSessionCookie, signInWithGoogle } from "./index.js";

const STATE_COOKIE = "sa_oauth_state";
const STATE_TTL_SECONDS = 10 * 60;
const CALLBACK_PATH = "/api/auth/google/callback";
const POST_SIGNIN_REDIRECT = "/dashboard";

export function registerGoogleOAuthRoutes(app: Hono<AppEnv>): void {
  app.get("/api/auth/google/start", (c) => {
    const state = randomBytes(32).toString("hex");
    setCookie(c, STATE_COOKIE, state, {
      path: "/",
      maxAge: STATE_TTL_SECONDS,
      httpOnly: true,
      sameSite: "Lax",
      secure: isRequestSecure(c),
    });

    const oauth = defaultGoogleOAuthConfig();
    const url = buildOAuth2AuthUrl(oauth, edgeUrl(c, CALLBACK_PATH), state);
    return c.redirect(url, 302);
  });

  app.get(CALLBACK_PATH, async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const providerError = c.req.query("error");
    if (providerError) throw new HTTPException(400, { message: `google_oauth_error: ${providerError}` });
    if (!code || !state) throw new HTTPException(400, { message: "missing_code_or_state" });

    const cookieState = getCookie(c, STATE_COOKIE);
    if (!cookieState || cookieState !== state) {
      throw new HTTPException(400, { message: "invalid_state" });
    }
    deleteCookie(c, STATE_COOKIE, { path: "/" });

    const oauth = defaultGoogleOAuthConfig();
    const tokens = await exchangeOAuth2Code(oauth, code, edgeUrl(c, CALLBACK_PATH));
    const userInfo = await fetchGoogleUserInfo(tokens.accessToken);

    const result = await signInWithGoogle({
      sub: userInfo.sub,
      email: userInfo.email,
      emailVerified: userInfo.emailVerified,
      name: userInfo.name,
    });

    setSessionCookie(c, result.sessionId, result.expiresAt);
    return c.redirect(edgeUrl(c, POST_SIGNIN_REDIRECT), 302);
  });
}
