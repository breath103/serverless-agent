import { PostHog } from "posthog-node";

export const posthog = process.env.POSTHOG_KEY
  ? new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST,
    })
  : null;
