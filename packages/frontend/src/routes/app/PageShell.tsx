import { Clock } from "@/components/ui/clock";
import { Typewriter } from "@/components/ui/typewriter";
import { cn } from "@/lib/utils";

// Page chrome shared by every dashboard route. Renders an eyebrow / title /
// actions block, an amber hairline rule, and a live UTC clock pinned to the
// rule. Children fill the remaining vertical space.
//
// `eyebrow` defaults to "DASHBOARD // <title>" so callsites don't have to
// pass it explicitly. Set `scroll={false}` for layouts that manage their own
// scroll (e.g. multi-column splits).
export function PageShell({
  title,
  eyebrow,
  actions,
  scroll = true,
  children,
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  scroll?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
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
  const computedEyebrow = eyebrow ?? `DASHBOARD // ${title.toUpperCase()}`;
  return (
    <header className="shrink-0 px-8 pt-5 pb-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="hud-eyebrow">{computedEyebrow}</div>
          <h1 className="mt-1 hud-title" style={{ fontSize: "1.625rem" }}>
            <Typewriter text={title.toUpperCase()} speed={26} />
          </h1>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="hud-rule flex-1" />
        <Clock
          className="shrink-0 hud-caption text-mint tabular-nums"
          style={{ fontSize: "0.6875rem", letterSpacing: "0.05em" }}
        />
      </div>
    </header>
  );
}
