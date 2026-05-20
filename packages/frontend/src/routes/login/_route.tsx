import { createRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useOnChange } from "@/hooks/useOnChange";

import { rootRoute } from "../__root";

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();

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
          <h1 className="hud-title" style={{ fontSize: "1.75rem" }}>Sign in</h1>
          <div className="mt-1 hud-rule" />
        </header>

        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => { window.location.href = "/api/auth/google/start"; }}
        >
          Continue with Google
        </Button>

        <p className="hud-caption">
          Google is the only sign-in method.
        </p>
      </div>
    </div>
  );
}
