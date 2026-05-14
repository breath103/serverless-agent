import { createRoute, Outlet } from "@tanstack/react-router";

import { dashboardRoute } from "../_route";

export const dashboardSettingsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/settings",
  component: () => <Outlet />,
});
