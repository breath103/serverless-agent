import { randomBytes } from "node:crypto";

import { profilesRepo } from "../profiles/profiles-repository.js";
import type { UserRow } from "../types/database.js";
import { usersRepo } from "../users/users-repository.js";
import { hashPassword, verifyPassword } from "./password.js";
import { sessionsRepo } from "./sessions-repository.js";

/** Cookie name carrying the session id in `Set-Cookie` / `Cookie` headers. */
const SESSION_COOKIE = "sa_session";

/** Session lifetime (30 days). */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Shape the rest of the app sees after resolving a session to a user. */
export type AuthUser = Pick<UserRow, "id" | "username" | "name">;

/** Thrown by `signUp` when the requested username is already registered. */
export class UsernameTakenError extends Error {
  constructor() {
    super("username_taken");
    this.name = "UsernameTakenError";
  }
}

function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

function newSessionId(): string {
  return randomBytes(32).toString("hex");
}

export async function signUp(input: {
  username: string;
  password: string;
  name: string;
}): Promise<{ user: AuthUser; sessionId: string; expiresAt: Date }> {
  const existing = await usersRepo.getByUsername(input.username);
  if (existing) throw new UsernameTakenError();

  const passwordHash = await hashPassword(input.password);
  const user = await usersRepo.create({
    username: input.username,
    passwordHash,
    name: input.name,
  });

  // Bootstrap a matching profile row so the agent has somewhere to hang
  // display-name / locale preferences.
  await profilesRepo.create(user.id, { name: input.name });

  const sessionId = newSessionId();
  const expiresAt = sessionExpiry();
  await sessionsRepo.create({ id: sessionId, userId: user.id, expiresAt });

  return {
    user: { id: user.id, username: user.username, name: user.name },
    sessionId,
    expiresAt,
  };
}

export async function signIn(input: {
  username: string;
  password: string;
}): Promise<{ user: AuthUser; sessionId: string; expiresAt: Date } | null> {
  const user = await usersRepo.getByUsername(input.username);
  if (!user) return null;
  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) return null;

  const sessionId = newSessionId();
  const expiresAt = sessionExpiry();
  await sessionsRepo.create({ id: sessionId, userId: user.id, expiresAt });

  return {
    user: { id: user.id, username: user.username, name: user.name },
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
  return { id: user.id, username: user.username, name: user.name };
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

export function buildSessionSetCookie(sessionId: string, expiresAt: Date): string {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    `Expires=${expiresAt.toUTCString()}`,
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
  ];
  return attrs.join("; ");
}

export function buildClearSessionCookie(): string {
  const attrs = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
  ];
  return attrs.join("; ");
}
