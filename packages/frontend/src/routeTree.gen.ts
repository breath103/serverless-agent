import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/$index/_route";
import { appLayout } from "./routes/app/_route";
import { dashboardRoute } from "./routes/app/dashboard/_route";
import { dashboardIndexRoute } from "./routes/app/dashboard/$index/_route";
import { chatsRoute } from "./routes/app/dashboard/chats/_route";
import { chatDetailRoute } from "./routes/app/dashboard/chats/$chatId/_route";
import { memoriesRoute } from "./routes/app/dashboard/memories/_route";
import { memoryDetailRoute } from "./routes/app/dashboard/memories/$memoryId/_route";
import { dashboardSettingsRoute } from "./routes/app/dashboard/settings/_route";
import { profileRoute } from "./routes/app/dashboard/settings/profile/_route";
import { skillsRoute } from "./routes/app/dashboard/settings/skills/_route";
import { designCheckRoute } from "./routes/design-check/_route";
import { loginRoute } from "./routes/login/_route";

export const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  designCheckRoute,
  appLayout.addChildren([
    dashboardRoute.addChildren([
      dashboardIndexRoute,
      memoriesRoute.addChildren([
        memoryDetailRoute,
      ]),
      chatsRoute.addChildren([
        chatDetailRoute,
      ]),
      dashboardSettingsRoute.addChildren([
        profileRoute,
        skillsRoute,
      ]),
    ]),
  ]),
]);
