import type { Context } from "hono";

import type { AuthUser } from "../auth/index.js";
import { routeFactory, routesFactory } from "./route.js";

export type AppEnv = {
  Variables: {
    user: AuthUser | null;
    sessionId: string | null;
    requireUser: () => AuthUser;
  };
};

type AppContext = Context<AppEnv>;

export const route = routeFactory<AppContext>();
export const routes = routesFactory<AppContext>();
