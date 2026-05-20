import { route } from "../../lib/app-context.js";

export const routes = [
  route("/api/health", "GET", {
    handler: ({ c }) => {
      const user = c.get("user");
      return {
        status: "ok" as const,
        timestamp: Date.now(),
        user: user ? { id: user.id, name: user.name, email: user.email } : null,
        region: process.env.AWS_REGION,
      };
    },
  }),
] as const;
