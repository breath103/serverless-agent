import { createRoute, Outlet } from "@tanstack/react-router";

import { appLayout } from "../_route";

export const dashboardRoute = createRoute({
  getParentRoute: () => appLayout,
  path: "/dashboard",
  component: DashboardLayout,
});

function DashboardLayout() {
  return (<Outlet />);
}
