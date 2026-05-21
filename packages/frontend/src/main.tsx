import { createRoot } from "react-dom/client";

import { createRouter, RouterProvider } from "@tanstack/react-router";

import { ModalProvider } from "@/components/ui/modal";
import { AuthProvider } from "@/contexts/AuthContext";
import { PosthogProvider } from "@/contexts/PosthogContext";
import { RepositoryProvider } from "@/contexts/RepositoryContext";

import { routeTree } from "./routeTree.gen";

import "./global.css";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// StrictMode removed — BlockNote has known issues with React 19 StrictMode.
// This only affects development double-rendering; zero production impact.
createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <PosthogProvider>
      <RepositoryProvider>
        <ModalProvider>
          <RouterProvider router={router} />
        </ModalProvider>
      </RepositoryProvider>
    </PosthogProvider>
  </AuthProvider>,
);
