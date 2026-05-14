// Decorative bordered badges with cryptic codenames, scattered around the
// margins. They look like equipment tags / safety stickers on a console.
// Don't mean anything — that's the whole point.

export function CodenameBadgesRight() {
  return (
    <div
      className="pointer-events-none absolute top-32 right-8 hidden flex-col items-end gap-3 lg:flex"
      aria-hidden
    >
      <Badge label="ZEPHYR-04" sub="FIRST CONTACT" tone="amber" />
      <Badge label="DELTA-RING 7" sub="LAYER 3 // OK" tone="mint" />
      <Badge label="SIGMA UNIT D-17" sub="87TH PROTEIN WALL" tone="amber" />
    </div>
  );
}

export function CodenameBadgesBottomRight() {
  return (
    <div
      className="pointer-events-none absolute right-8 bottom-12 hidden flex-col items-end gap-3 lg:flex"
      aria-hidden
    >
      <Badge label="PROTECT NO. 666" sub="ON CORE-01 ORIGINAL" tone="amber" />
      <CautionBadge />
    </div>
  );
}

function Badge({
  label,
  sub,
  tone,
}: {
  label: string;
  sub: string;
  tone: "amber" | "mint";
}) {
  const cls = tone === "mint" ? "border-mint text-mint" : "border-amber text-amber";
  return (
    <div
      className={`border px-3 py-1.5 bloom-edge ${cls}`}
      style={{
        fontSize: "0.625rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: "rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: "0.6875rem" }}>{label}</div>
      <div className="text-amber-dim">{sub}</div>
    </div>
  );
}

// Diagonal-stripe caution badge — the iconic "CAUTION" placeholder.
function CautionBadge() {
  return (
    <div
      className="relative flex items-center gap-2 px-3 py-2"
      style={{
        background:
          "repeating-linear-gradient(135deg, rgba(255, 51, 68, 0.18) 0 6px, rgba(0,0,0,0) 6px 12px), rgba(0,0,0,0.4)",
        border: "1px solid var(--red)",
      }}
    >
      <span className="text-red" aria-hidden style={{ fontSize: "0.875rem" }}>▲</span>
      <div>
        <div
          className="text-red"
          style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
        >
          CAUTION
        </div>
        <div
          className="text-red"
          style={{ fontSize: "0.5625rem", letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.85 }}
        >
          UNAUTHENTICATED ZONE
        </div>
      </div>
    </div>
  );
}
