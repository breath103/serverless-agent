import { useState } from "react";

import { createRoute, useNavigate } from "@tanstack/react-router";

import { Typewriter } from "@/components/ui/typewriter";
import { useAuth } from "@/contexts/AuthContext";
import { useOnChange } from "@/hooks/useOnChange";

import { rootRoute } from "../__root";
import { BackgroundReticle } from "./BackgroundReticle";
import { LoginFooter, LoginHeader } from "./Chrome";
import { CodenameBadgesBottomRight, CodenameBadgesRight } from "./CodenameBadges";
import { EmailPasswordForm } from "./EmailPasswordForm";
import { ProcessLog } from "./ProcessLog";
import { SessionStrip } from "./SessionStrip";

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  useOnChange(() => {
    if (auth) {
      void navigate({ to: "/dashboard" });
    }
  }, [auth, navigate]);

  if (auth) return null;

  return (
    <div className="relative flex size-full flex-col overflow-hidden px-8 py-6">
      <BackgroundReticle />
      <ProcessLog />
      <CodenameBadgesRight />
      <CodenameBadgesBottomRight />

      <LoginHeader />

      <div className="relative z-10 flex flex-1 items-center justify-center py-10">
        <div className="flex w-full max-w-[460px] flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="hud-label">AUTH MODULE [01]</span>
            <span className="flex items-center gap-1.5 hud-caption text-mint">
              <span className="animate-hud-blink" aria-hidden>▪</span>OPERATIONAL
            </span>
          </div>

          <div className="hud-panel-op hud-panel p-7">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="hud-title text-amber" style={{ fontSize: "1.25rem" }}>
                <Typewriter
                  text={mode === "sign-in" ? "AUTHENTICATE" : "REGISTER"}
                  speed={28}
                />
              </h2>
              <span className="flex items-center gap-1.5 hud-eyebrow text-mint">
                <span aria-hidden>▪</span>
                {mode === "sign-in" ? "RETURNING OPERATOR" : "NEW OPERATOR"}
              </span>
            </div>

            <EmailPasswordForm
              mode={mode}
              onSuccess={() => void navigate({ to: "/dashboard" })}
            />

            <div className="mt-6 flex items-center justify-between">
              <span className="hud-caption">
                {mode === "sign-in" ? "NO ACCOUNT?" : "ALREADY ENROLLED?"}
              </span>
              <button
                type="button"
                onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
                className="hud-caption text-mint underline-offset-4 hover:underline"
                style={{ letterSpacing: "0.08em" }}
              >
                {mode === "sign-in" ? "// REGISTER" : "// AUTHENTICATE"}
              </button>
            </div>
          </div>

          <SessionStrip />
        </div>
      </div>

      <LoginFooter />
    </div>
  );
}
