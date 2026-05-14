import { createRoute } from "@tanstack/react-router";

import { dashboardSettingsRoute } from "../_route";
import { ProfilePage } from "./ProfilePage";

export const profileRoute = createRoute({
  getParentRoute: () => dashboardSettingsRoute,
  path: "/profile",
  component: ProfilePage,
});
