// A small "diagnostic" strip below the auth panel — three labelled data
// values in mint, separated by hairline pipes. Adds color rhythm without
// crowding the panel itself. Values are static here (the backend doesn't
// ship a pre-auth diagnostics endpoint), but they're picked to feel real.

const FIELDS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "SESSION", value: "PRE-AUTH" },
  { label: "CHANNEL", value: "TLS-1.3" },
  { label: "NODE", value: detectNode() },
];

export function SessionStrip() {
  return (
    <div className="flex items-center justify-between gap-4 px-1">
      {FIELDS.map((f, i) => (
        <div key={f.label} className="flex flex-1 items-center gap-2">
          {i > 0 && <span className="text-amber-hair" aria-hidden>│</span>}
          <span className="hud-caption">{f.label}</span>
          <span className="text-mint tabular-nums" style={{ fontSize: "0.6875rem", letterSpacing: "0.06em" }}>
            {f.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function detectNode(): string {
  if (typeof Intl === "undefined") return "LOCAL";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? tz.replace(/_/g, " ").toUpperCase() : "LOCAL";
  } catch {
    return "LOCAL";
  }
}
