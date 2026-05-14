import { z } from "zod";

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  ChatCircleIcon,
  TreeStructureIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { Link, useRouterState } from "@tanstack/react-router";

import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { cn } from "@/lib/utils";

import { SidebarBottomBar } from "./SidebarBottomBar";
import { SidebarBrandHeader } from "./SidebarBrandHeader";

type Item = { icon: PhosphorIcon; label: string; href: string };

const MAIN_ITEMS: Item[] = [
  { icon: TreeStructureIcon, label: "MEMORY", href: "/dashboard/memories" },
  { icon: ChatCircleIcon, label: "CHAT", href: "/dashboard/chats" },
];

const SETTINGS_ITEMS: Item[] = [
  { icon: UserCircleIcon, label: "PROFILE", href: "/dashboard/settings/profile" },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useLocalStorageState(
    "sidebar:collapsed",
    z.boolean(),
    false,
  );
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-amber bg-background transition-[width] duration-200",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <SidebarBrandHeader
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />

      <nav className="flex flex-1 flex-col gap-3 px-3 pt-4">
        <Section
          label="MAIN"
          count={MAIN_ITEMS.length}
          collapsed={collapsed}
        >
          {MAIN_ITEMS.map((item) => (
            <SidebarItem
              key={item.href}
              {...item}
              collapsed={collapsed}
              active={isActive(item.href)}
            />
          ))}
        </Section>

        <Section
          label="SETTINGS"
          count={SETTINGS_ITEMS.length}
          collapsed={collapsed}
        >
          {SETTINGS_ITEMS.map((item) => (
            <SidebarItem
              key={item.href}
              {...item}
              collapsed={collapsed}
              active={isActive(item.href)}
            />
          ))}
        </Section>
      </nav>

      <SidebarBottomBar collapsed={collapsed} />
    </aside>
  );
}

function Section({
  label,
  count,
  collapsed,
  children,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {collapsed ? (
        <div className="my-1 h-px bg-amber-hair" />
      ) : (
        <div className="px-2 pb-1 hud-label">
          {label} [{count}]
        </div>
      )}
      {children}
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  href,
  collapsed,
}: Item & { active: boolean; collapsed: boolean }) {
  return (
    <Link
      to={href}
      title={collapsed ? label : undefined}
      className={cn(
        "selectable-button-accent-1",
        "relative flex h-9 items-center text-[0.6875rem] font-semibold",
        "text-text-2 hover:text-text-1",
        collapsed ? "justify-center px-0" : "gap-3 px-2",
      )}
      style={{ letterSpacing: "0.1em" }}
    >
      {/* Active marker: a small mint square pinned to the row. The
          selectable-button utility supplies background + text-color flips,
          but the leading pip provides a stronger "currently selected" cue. */}
      {active && !collapsed && (
        <span
          aria-hidden
          className="absolute left-0 inline-block h-3 w-0.5 bg-mint"
        />
      )}
      <Icon size={15} weight={active ? "fill" : "regular"} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
