import { createRoute } from "@tanstack/react-router";

import { dashboardSettingsRoute } from "../_route";
import { SkillsPage } from "./SkillsPage";

export const skillsRoute = createRoute({
  getParentRoute: () => dashboardSettingsRoute,
  path: "/skills",
  component: SkillsPage,
});
