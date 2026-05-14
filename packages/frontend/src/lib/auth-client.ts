/**
 * Simple fetch-based auth client. Talks to the backend's
 * `/api/auth/{sign-in,sign-up,sign-out,session}` endpoints; session id is
 * carried in an HTTP-only cookie set by the server.
 */

export type AuthUser = {
  id: string;
  username: string;
  name: string;
};

export type SessionData = {
  user: AuthUser;
};

type JsonRecord = Record<string, string>;

async function postJson<T>(path: string, body: JsonRecord): Promise<{ data: T | null; error: { message: string } | null }> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null) as { error?: string } | null;
    const message = payload?.error ?? `HTTP ${res.status}`;
    return { data: null, error: { message } };
  }
  const data = await res.json() as T;
  return { data, error: null };
}

export const authClient = {
  async getSession(): Promise<{ data: SessionData | null }> {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) return { data: null };
    const json = await res.json() as { user: AuthUser | null };
    if (!json.user) return { data: null };
    return { data: { user: json.user } };
  },

  signIn: {
    username({ username, password }: { username: string; password: string }) {
      return postJson<{ user: AuthUser }>("/api/auth/sign-in", { username, password });
    },
  },

  signUp: {
    username({ username, password, name }: { username: string; password: string; name: string }) {
      return postJson<{ user: AuthUser }>("/api/auth/sign-up", { username, password, name });
    },
  },

  async signOut(): Promise<void> {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
  },
};
