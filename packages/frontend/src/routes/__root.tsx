import { createRootRoute, Outlet } from "@tanstack/react-router";

import { CrtScreen } from "@/components/ui/crt-screen";
import { PosthogProvider } from "@/contexts/PosthogContext";

function RootComponent() {
  return (
    <PosthogProvider>
      <CrtScreen className="flex h-screen flex-col">
        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      </CrtScreen>
    </PosthogProvider>
  );
}

export const rootRoute = createRootRoute({
  component: RootComponent,
});
