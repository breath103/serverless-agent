import { randomBytes } from "node:crypto";

import { deleteCookie, setCookie } from "hono/cookie";

import { accountsRepo } from "../accounts/accounts-repository.js";
import type { AppContext } from "../lib/app-context.js";
import { profilesRepo } from "../profiles/profiles-repository.js";
import type { UserRow } from "../types/database.js";
import { usersRepo } from "../users/users-repository.js";
import { sessionsRepo } from "./sessions-repository.js";

/** Cookie name carrying the session id in `Set-Cookie` / `Cookie` headers. */
const SESSION_COOKIE = "sa_session";

/** Session lifetime (30 days). */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Shape the rest of the app sees after resolving a session to a user.
 * `email` is joined from the user's `accounts` row at resolve time so
 * downstream code doesn't have to load the accounts table separately.
 */
export type AuthUser = Pick<UserRow, "id" | "name"> & { email: string };

function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

function newSessionId(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Find-or-create the user behind a freshly verified Google identity.
 * Lookup goes through `accounts` (by provider+sub) — `users` is keyed by
 * uuid and never queried by email.
 */
export async function signInWithGoogle(input: {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}): Promise<{ user: AuthUser; sessionId: string; expiresAt: Date }> {
  const existingAccount = await accountsRepo.findByProviderSub({ provider: "google", sub: input.sub });

  let user: UserRow;
  if (existingAccount) {
    const found = await usersRepo.getById(existingAccount.user_id);
    if (!found) {
      throw new Error(`Account ${input.sub} references missing user ${existingAccount.user_id}`);
    }
    user = found;
  } else {
    user = await usersRepo.create({ name: input.name });
    await profilesRepo.create(user.id, { name: input.name });
    await accountsRepo.create({
      userId: user.id,
      provider: "google",
      sub: input.sub,
      email: input.email,
      emailVerified: input.emailVerified,
    });
  }

  const sessionId = newSessionId();
  const expiresAt = sessionExpiry();
  await sessionsRepo.create({ id: sessionId, userId: user.id, expiresAt });

  return {
    user: { id: user.id, name: user.name, email: input.email },
    sessionId,
    expiresAt,
  };
}

export async function signOut(sessionId: string): Promise<void> {
  await sessionsRepo.delete(sessionId);
}

export async function resolveSession(sessionId: string): Promise<AuthUser | null> {
  const session = await sessionsRepo.get(sessionId);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await sessionsRepo.delete(sessionId).catch(() => undefined);
    return null;
  }
  const user = await usersRepo.getById(session.user_id);
  if (!user) return null;
  const accounts = await accountsRepo.listForUser(user.id);
  const primaryEmail = accounts[0]?.email;
  if (!primaryEmail) return null;
  return { id: user.id, name: user.name, email: primaryEmail };
}

export function parseSessionCookie(cookieHeader: string | undefined | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === SESSION_COOKIE && rest.length > 0) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

// Safari rejects `Secure` cookies over plain HTTP, even on localhost; Chrome allows them.
export function isRequestSecure(c: AppContext): boolean {
  const proto = (c.req.header("x-forwarded-proto") ?? "https").split(",")[0].trim().toLowerCase();
  return proto !== "http";
}

export function setSessionCookie(c: AppContext, sessionId: string, expiresAt: Date): void {
  setCookie(c, SESSION_COOKIE, sessionId, {
    path: "/",
    expires: expiresAt,
    httpOnly: true,
    sameSite: "Lax",
    secure: isRequestSecure(c),
  });
}

export function clearSessionCookie(c: AppContext): void {
  deleteCookie(c, SESSION_COOKIE, {
    path: "/",
    secure: isRequestSecure(c),
  });
}
