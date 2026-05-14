import { useEffect } from "react";

import { PostHogProvider, usePostHog } from "@posthog/react";

import { useAuth } from "@/contexts/AuthContext";

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  if (!process.env.POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      apiKey={process.env.POSTHOG_KEY}
      options={{
        api_host: process.env.POSTHOG_HOST,
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
      }}
    >
      <PosthogIdentify />
      {children}
    </PostHogProvider>
  );
}

function PosthogIdentify() {
  const posthog = usePostHog();
  const auth = useAuth();

  useEffect(() => {
    if (auth?.user.id) {
      posthog.identify(auth.user.id);
    }
  }, [posthog, auth?.user.id]);

  return null;
}
