import { cn } from "@/lib/utils";

export type PageChannel = "cyan" | "magenta" | "coral" | "amber" | "mint";

// Page chrome shared by every dashboard route. Renders an eyebrow / title /
// actions block and a channel-colored hairline rule. Children fill the
// remaining vertical space.
//
// `channel` sets --accent-1 for the whole page so buttons, rules, focus rings,
// and selectable rows pick up the section's hue. Defaults to cyan.
export function PageShell({
  title,
  eyebrow,
  actions,
  scroll = true,
  channel = "cyan",
  children,
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  scroll?: boolean;
  channel?: PageChannel;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(`channel-${channel}`, "flex h-full flex-col")}>
      <PageHeader title={title} eyebrow={eyebrow} actions={actions} />
      <div className={cn("min-h-0 flex-1", scroll ? "overflow-auto" : "overflow-hidden")}>
        {children}
      </div>
    </div>
  );
}

/**
 * Just the top header chrome from PageShell — for routes that need a custom
 * outer wrapper (e.g. a `<form>`) but still want the same header styling.
 */
export function PageHeader({
  title,
  eyebrow,
  actions,
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  const computedEyebrow = eyebrow ?? `Dashboard // ${title}`;
  return (
    <header className="shrink-0 px-8 pt-5 pb-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="hud-eyebrow">{computedEyebrow}</div>
          <h1 className="mt-1 hud-title" style={{ fontSize: "1.625rem" }}>
            {title}
          </h1>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      <div className="mt-3 hud-rule" />
    </header>
  );
}
