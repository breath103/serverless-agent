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

export type AppContext = Context<AppEnv>;

export const route = routeFactory<AppContext>();
export const routes = routesFactory<AppContext>();

/** Build a full URL through the edge proxy (uses forwarded headers in prod, host header in dev). */
export function edgeUrl(c: AppContext, path: string): string {
  const proto = (c.req.header("x-forwarded-proto") ?? "http").split(",")[0].trim();
  const host = (c.req.header("x-forwarded-host") ?? c.req.header("host") ?? "").split(",")[0].trim();
  return `${proto}://${host}${path}`;
}
