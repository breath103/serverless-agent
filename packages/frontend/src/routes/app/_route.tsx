import { useEffect } from "react";

import { createRoute, Outlet, useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/contexts/AuthContext";
import { RealtimeProvider, useRealtime } from "@/contexts/RealtimeContext";
import { useApplyEntityUpdate } from "@/contexts/RepositoryContext";

import { rootRoute } from "../__root";
import { Sidebar } from "./Sidebar";

export const appLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "_app",
  component: AppLayout,
});

function AppLayout() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth) void navigate({ to: "/login" });
  }, [auth, navigate]);

  if (!auth) return null;

  return (
    <RealtimeProvider>
      <RepositoryMqttBridge />
      <div className="flex size-full bg-background text-text-1">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </RealtimeProvider>
  );
}

/** Forwards MQTT entity_update events into the entity repository so
 *  list queries auto-update live. */
function RepositoryMqttBridge() {
  const { event$ } = useRealtime();
  const applyEntityUpdate = useApplyEntityUpdate();

  useEffect(() => {
    const sub = event$.subscribe((e) => {
      if (e.type === "entity_update") applyEntityUpdate(e);
    });
    return () => sub.unsubscribe();
  }, [event$, applyEntityUpdate]);

  return null;
}
