import { createRoute } from "@tanstack/react-router";

import { chatsRoute } from "../_route";

export const chatDetailRoute = createRoute({
  getParentRoute: () => chatsRoute,
  path: "/$chatId",
  component: () => null,
});
