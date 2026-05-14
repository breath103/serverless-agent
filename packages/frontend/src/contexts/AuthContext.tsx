import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { authClient, type SessionData } from "@/lib/auth-client";

interface AuthValue {
  user: SessionData["user"];
}

interface AuthContextValue {
  auth: AuthValue | null;
  status: "loading" | "authenticated" | "unauthenticated";
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthState =
  | { status: "loading"; session: null }
  | { status: "authenticated"; session: SessionData }
  | { status: "unauthenticated"; session: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", session: null });

  const refresh = useCallback(async () => {
    const { data } = await authClient.getSession();
    if (data?.user) {
      setState({ status: "authenticated", session: data });
    } else {
      setState({ status: "unauthenticated", session: null });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session must be resolved once on mount
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setState({ status: "unauthenticated", session: null });
  }, []);

  const auth: AuthValue | null = useMemo(() => {
    const { session } = state;
    if (!session?.user) return null;
    return { user: session.user };
  }, [state]);

  const value = useMemo<AuthContextValue>(
    () => ({ auth, status: state.status, signOut, refresh }),
    [auth, state.status, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Returns `{ user }` if logged in, `null` otherwise. */
export function useAuth(): AuthValue | null {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context.auth;
}

/** Returns the resolved auth status. `loading` until the session fetch settles. */
export function useAuthStatus(): AuthContextValue["status"] {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthStatus must be used within AuthProvider");
  return context.status;
}

/** Returns `{ user }` — throws if not logged in. Use inside auth-protected routes. */
export function useRequiredAuth(): AuthValue {
  const auth = useAuth();
  if (!auth) throw new Error("useRequiredAuth: not authenticated");
  return auth;
}

/** Returns the signOut function that clears cache + signs out from backend. */
export function useSignOut(): () => Promise<void> {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useSignOut must be used within AuthProvider");
  return context.signOut;
}

/** Returns a function that re-fetches the session (use after sign-in / sign-up). */
export function useRefreshAuth(): () => Promise<void> {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useRefreshAuth must be used within AuthProvider");
  return context.refresh;
}
