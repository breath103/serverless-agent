/**
 * Simple fetch-based auth client. Talks to the backend's
 * `/api/auth/{sign-out,session}` endpoints; session id is carried in an
 * HTTP-only cookie set by `/api/auth/google/callback`.
 */
import type { AuthUser } from "@backend/auth";

export type SessionData = {
  user: AuthUser;
};

export const authClient = {
  async getSession(): Promise<{ data: SessionData | null }> {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) return { data: null };
    const json = await res.json() as { user: AuthUser | null };
    if (!json.user) return { data: null };
    return { data: { user: json.user } };
  },

  async signOut(): Promise<void> {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
  },
};
