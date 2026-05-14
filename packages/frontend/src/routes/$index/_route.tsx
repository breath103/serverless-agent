import { useEffect } from "react";

import { createRoute, useNavigate } from "@tanstack/react-router";

import { useAuthStatus } from "@/contexts/AuthContext";

import { rootRoute } from "../__root";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexRedirect,
});

function IndexRedirect() {
  const status = useAuthStatus();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated") {
      void navigate({ to: "/dashboard", replace: true });
    } else if (status === "unauthenticated") {
      void navigate({ to: "/login", replace: true });
    }
  }, [status, navigate]);

  return null;
}
