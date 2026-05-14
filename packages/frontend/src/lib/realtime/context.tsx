import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import type { Observable } from "rxjs";

import { type GetRealtimeConnection, RealtimeClient, type RealtimeStatus } from "./client";

interface RealtimeContextValue<TEvent> {
  event$: Observable<TEvent>;
  status$: Observable<RealtimeStatus>;
}

/**
 * Factory for a realtime context typed to `TEvent`.
 *
 * No runtime schema is passed — the backend is trusted to publish
 * events matching `TEvent`'s shape. Inbound payloads are parsed via
 * superjson and forwarded as-is (cast). If the backend drifts, the
 * frontend will see malformed data; catch that at the event handler.
 *
 * `getConnection` is caller-supplied so the realtime lib stays
 * decoupled from any specific API route.
 *
 * Mount `Provider` only where the user is known to be authenticated
 * (e.g. below an `AppLayout` that redirects unauthed users).
 *
 * @example
 * import type { RealtimeEvent } from "@backend/lib/realtime-events";
 * export const { Provider, useRealtime } = createRealtimeContext<RealtimeEvent>({
 *   getConnection: () => api.fetch("/api/realtime/connection", "GET"),
 * });
 */
export function createRealtimeContext<TEvent>(opts: {
  getConnection: GetRealtimeConnection;
}): {
  Provider: (props: { children: ReactNode }) => React.ReactElement;
  useRealtime: () => RealtimeContextValue<TEvent>;
} {
  const Context = createContext<RealtimeContextValue<TEvent> | null>(null);

  function Provider({ children }: { children: ReactNode }) {
    const client = useMemo(() => new RealtimeClient<TEvent>(opts.getConnection), []);

    useEffect(() => {
      client.start();
      return () => client.stop();
    }, [client]);

    const value = useMemo<RealtimeContextValue<TEvent>>(
      () => ({ event$: client.event$, status$: client.status$ }),
      [client],
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useRealtime(): RealtimeContextValue<TEvent> {
    const ctx = useContext(Context);
    if (!ctx) throw new Error("useRealtime must be used within the RealtimeProvider");
    return ctx;
  }

  return { Provider, useRealtime };
}
