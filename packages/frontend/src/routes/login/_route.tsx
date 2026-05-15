import { useState } from "react";

import { createRoute, useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/contexts/AuthContext";
import { useOnChange } from "@/hooks/useOnChange";

import { rootRoute } from "../__root";
import { EmailPasswordForm } from "./EmailPasswordForm";

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
    <div className="flex size-full items-center justify-center px-6 channel-cyan">
      <div className="flex w-full max-w-[420px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <span className="hud-eyebrow">serverless // agent</span>
          <h1 className="hud-title" style={{ fontSize: "1.75rem" }}>
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </h1>
          <div className="mt-1 hud-rule" />
        </header>

        <EmailPasswordForm
          mode={mode}
          onSuccess={() => void navigate({ to: "/dashboard" })}
        />

        <div className="flex items-center justify-between hud-caption">
          <span>{mode === "sign-in" ? "No account yet?" : "Already have one?"}</span>
          <button
            type="button"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            className="underline-offset-4 hover:underline"
            style={{ color: "var(--accent-1)", letterSpacing: "0.06em" }}
          >
            {mode === "sign-in" ? "Register" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
