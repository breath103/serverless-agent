import { SidebarSimpleIcon } from "@phosphor-icons/react";

import { useRequiredAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function SidebarBrandHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { user } = useRequiredAuth();
  return (
    <div
      className={cn(
        "flex h-16 items-center border-b border-amber",
        collapsed ? "justify-center" : "justify-between gap-2 pr-2 pl-4",
      )}
    >
      {!collapsed && (
        <div className="min-w-0">
          <div className="hud-eyebrow">SERVERLESS // AGENT</div>
          <div
            className="mt-0.5 truncate text-mint"
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {user.name}
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggle}
        className="icon-ghost-button size-8"
      >
        <SidebarSimpleIcon size={16} />
      </button>
    </div>
  );
}
