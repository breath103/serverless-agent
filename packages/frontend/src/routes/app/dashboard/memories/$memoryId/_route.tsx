import { createRoute } from "@tanstack/react-router";

import { memoriesRoute } from "../_route";

export const memoryDetailRoute = createRoute({
  getParentRoute: () => memoriesRoute,
  path: "/$memoryId",
  component: () => null,
});
