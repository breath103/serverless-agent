import { useCallback, useEffect, useState } from "react";

import type { InstallableSkillId } from "@backend/skills/index";
import type { UserSkillRow } from "@backend/types/database";

import { Button } from "@/components/ui/button";
import { useRequiredAuth } from "@/contexts/AuthContext";
import { useRepositoryListQuery } from "@/contexts/RepositoryContext";
import { useMutation } from "@/hooks/useMutation";
import { api } from "@/lib/api";
import { PageShell } from "@/routes/app/PageShell";

import { SKILL_IDS, SKILLS } from "./skills";

// One-shot read of the post-OAuth redirect query params, then clears them
// from the URL so a reload doesn't re-show the banner.
function useOauthRedirectFlash(): { connected: string | null; error: string | null } {
  const [flash] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      connected: params.get("connected"),
      error: params.get("error"),
    };
  });
  useEffect(() => {
    if (flash.connected || flash.error) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [flash.connected, flash.error]);
  return flash;
}

export function SkillsPage() {
  const { user } = useRequiredAuth();
  const flash = useOauthRedirectFlash();

  const installed = useRepositoryListQuery(
    "user_skills",
    user.id,
    { filter: (r) => r.user_id === user.id },
    useCallback(async () => await api.fetch("/api/skills/installed", "GET"), []),
  );

  const byId = new Map<InstallableSkillId, UserSkillRow>();
  for (const row of installed.records) byId.set(row.data.skill_id, row);

  return (
    <PageShell title="Skills">
      <div className="px-8 pb-10">
        {flash.connected && (
          <Banner kind="ok" text={`CONNECTED // ${flash.connected.toUpperCase()}`} />
        )}
        {flash.error && <Banner kind="err" text={`! OAUTH FAILED // ${flash.error}`} />}

        <ul className="flex flex-col gap-3">
          {SKILL_IDS.map((id) => (
            <SkillCard key={id} skillId={id} row={byId.get(id) ?? null} />
          ))}
        </ul>
      </div>
    </PageShell>
  );
}

function SkillCard({ skillId, row }: { skillId: InstallableSkillId; row: UserSkillRow | null }) {
  const settings = SKILLS[skillId];

  return (
    <li className="flex items-center gap-4 border border-amber-hair p-4">
      <img src={settings.iconUrl} alt="" width={32} height={32} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="hud-label text-amber">{settings.displayName}</div>
        <div className="mt-0.5 text-[0.75rem] text-text-2">{settings.description}</div>
        {row && (
          <div className="mt-1 text-[0.6875rem] text-mint">
            {settings.buildAccountLabel(row.data.config)}
          </div>
        )}
      </div>
      {row ? <DisconnectButton row={row} /> : <ConnectButton skillId={skillId} />}
    </li>
  );
}

function ConnectButton({ skillId }: { skillId: InstallableSkillId }) {
  const connect = useMutation(
    async () => await api.fetch("/api/skills/install/oauth/redirect", "POST", { body: { skillId } }),
    [skillId],
  );
  return (
    <Button
      variant="primary"
      size="sm"
      loading={connect.status === "loading"}
      onClick={() => {
        void connect.call().then((result) => {
          if (result) window.location.href = result.redirectUrl;
        });
      }}
    >
      CONNECT
    </Button>
  );
}

function DisconnectButton({ row }: { row: UserSkillRow }) {
  const disconnect = useMutation(
    async () => await api.fetch("/api/skills/:id", "DELETE", { params: { id: row.id } }),
    [row.id],
  );
  return (
    <Button
      variant="destructive"
      size="sm"
      loading={disconnect.status === "loading"}
      onClick={() => { void disconnect.call(); }}
    >
      DISCONNECT
    </Button>
  );
}

function Banner({ kind, text }: { kind: "ok" | "err"; text: string }) {
  const color = kind === "ok" ? "border-mint-dim text-mint" : "border-red text-red";
  return (
    <div className={`mb-4 border px-3 py-2 text-[0.6875rem] tracking-wider uppercase ${color}`}>
      {text}
    </div>
  );
}
