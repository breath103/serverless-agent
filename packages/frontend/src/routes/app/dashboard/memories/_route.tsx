import { createRoute } from "@tanstack/react-router";

import { dashboardRoute } from "../_route";
import { MemoryPage } from "./MemoryPage";

export const memoriesRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/memories",
  component: MemoryPage,
});
