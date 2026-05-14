import { routes } from "../../lib/app-context.js";
import type { ExtractRoutes } from "../../lib/route.js";
import { routes as chatSessionRoutes } from "./chat-session.js";
import { routes as healthRoutes } from "./health.js";
import { routes as memoryRoutes } from "./memory.js";
import { routes as profileRoutes } from "./profile.js";
import { routes as realtimeRoutes } from "./realtime.js";

export const api = routes(
  ...healthRoutes,
  ...memoryRoutes,
  ...chatSessionRoutes,
  ...realtimeRoutes,
  ...profileRoutes,
);

/** @public — required from frontend */
export type ApiRoutes = ExtractRoutes<typeof api.routes>;
