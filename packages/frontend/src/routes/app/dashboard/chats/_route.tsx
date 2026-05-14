import { createRoute } from "@tanstack/react-router";

import { dashboardRoute } from "../_route";
import { ChatsPage } from "./ChatsPage";

export const chatsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/chats",
  component: ChatsPage,
});
