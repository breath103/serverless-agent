import { useCallback } from "react";

import { useRequiredAuth } from "@/contexts/AuthContext";
import { useRepositoryQuery } from "@/contexts/RepositoryContext";
import { api } from "@/lib/api";
import { PageShell } from "@/routes/app/PageShell";

import { ProfilePageLoaded } from "./ProfilePageLoaded";

export function ProfilePage() {
  const { user } = useRequiredAuth();
  const { entity: profile, status } = useRepositoryQuery(
    "profiles",
    { user_id: user.id },
    useCallback(async () => await api.fetch("/api/user/profile", "GET"), []),
  );

  if (!profile) {
    return (
      <PageShell title="Profile" channel="coral">
        <div className="flex h-full items-center justify-center">
          <span className="hud-label">
            {status === "error" ? "! FAILED TO LOAD PROFILE" : "LOADING…"}
          </span>
        </div>
      </PageShell>
    );
  }

  return <ProfilePageLoaded profile={profile} />;
}
