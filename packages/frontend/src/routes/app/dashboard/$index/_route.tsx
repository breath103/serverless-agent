import { useEffect } from "react";

import { createRoute, useNavigate } from "@tanstack/react-router";

import { dashboardRoute } from "../_route";

export const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/",
  component: DashboardIndexRedirect,
});

function DashboardIndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/dashboard/memories", replace: true });
  }, [navigate]);
  return null;
}
