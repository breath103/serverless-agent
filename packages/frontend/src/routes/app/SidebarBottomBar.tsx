import { CircleNotchIcon, SignOutIcon } from "@phosphor-icons/react";

import { useSignOut } from "@/contexts/AuthContext";
import { useMutation } from "@/hooks/useMutation";
import { cn } from "@/lib/utils";

export function SidebarBottomBar({ collapsed }: { collapsed: boolean }) {
  const signOut = useSignOut();
  const signOutMutation = useMutation(async () => {
    await signOut();
  }, [signOut]);
  const signingOut = signOutMutation.status === "loading";

  return (
    <div
      className={cn(
        "border-t border-amber px-3 py-2",
        collapsed ? "flex justify-center" : "flex items-center justify-between gap-2",
      )}
    >
      {!collapsed && (
        <div
          className="flex items-center gap-1.5 hud-caption text-mint"
          style={{ letterSpacing: "0.08em" }}
        >
          <span className="animate-hud-blink" aria-hidden>▪</span>
          <span>SECURE</span>
        </div>
      )}
      <button
        type="button"
        aria-label="Sign out"
        onClick={() => void signOutMutation.call()}
        disabled={signingOut}
        className="icon-ghost-button size-8 disabled:opacity-100"
      >
        {signingOut
          ? <CircleNotchIcon size={16} className="animate-hud-tick" />
          : <SignOutIcon size={16} />}
      </button>
    </div>
  );
}
