// Large concentric reticle + crosshair + tick marks + dotted grid. Sits
// behind the auth panel as an ambient "targeting display". Very dim by
// design (low opacity); it should read as instrumentation, not decoration.
//
// Pure SVG, no animation — the static-ness is the point. Like a piece of
// equipment frozen in standby.
export function BackgroundReticle() {
  return (
    <svg
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 m-auto"
      style={{
        width: "min(82vh, 82vw)",
        height: "min(82vh, 82vw)",
        opacity: 0.18,
      }}
      aria-hidden
    >
      <defs>
        <pattern id="reticle-dotgrid" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="11" cy="11" r="0.7" fill="var(--amber)" />
        </pattern>
      </defs>

      {/* dotted grid background */}
      <rect width="800" height="800" fill="url(#reticle-dotgrid)" />

      {/* concentric rings */}
      {[80, 160, 260, 360].map((r) => (
        <circle key={r} cx="400" cy="400" r={r} fill="none" stroke="var(--amber)" strokeWidth="1" />
      ))}

      {/* main crosshair */}
      <line x1="40" y1="400" x2="760" y2="400" stroke="var(--amber)" strokeWidth="0.8" />
      <line x1="400" y1="40" x2="400" y2="760" stroke="var(--amber)" strokeWidth="0.8" />

      {/* angle ticks every 30° on the outer ring */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = ((i * 30 - 90) * Math.PI) / 180;
        const r1 = 360, r2 = 384;
        return (
          <line
            key={i}
            x1={400 + Math.cos(angle) * r1}
            y1={400 + Math.sin(angle) * r1}
            x2={400 + Math.cos(angle) * r2}
            y2={400 + Math.sin(angle) * r2}
            stroke="var(--amber)"
            strokeWidth="1.2"
          />
        );
      })}

      {/* tiny mint frame at center — the "you are here" cue */}
      <rect x="376" y="376" width="48" height="48" fill="none" stroke="var(--mint)" strokeWidth="1" />
      <line x1="376" y1="400" x2="424" y2="400" stroke="var(--mint)" strokeWidth="0.6" />
      <line x1="400" y1="376" x2="400" y2="424" stroke="var(--mint)" strokeWidth="0.6" />

      {/* labels around the rings — useless data, that's the point */}
      <text x="400" y="32" textAnchor="middle" fill="var(--amber-dim)" fontSize="11" letterSpacing="2" fontFamily="JetBrains Mono Variable, monospace">
        N · 000.0°
      </text>
      <text x="768" y="404" textAnchor="end" fill="var(--amber-dim)" fontSize="11" letterSpacing="2" fontFamily="JetBrains Mono Variable, monospace">
        E · 090.0°
      </text>
      <text x="400" y="772" textAnchor="middle" fill="var(--amber-dim)" fontSize="11" letterSpacing="2" fontFamily="JetBrains Mono Variable, monospace">
        S · 180.0°
      </text>
      <text x="32" y="404" textAnchor="start" fill="var(--amber-dim)" fontSize="11" letterSpacing="2" fontFamily="JetBrains Mono Variable, monospace">
        W · 270.0°
      </text>

      {/* radius labels */}
      <text x="404" y="44" fill="var(--amber-dim)" fontSize="9" letterSpacing="1.5" fontFamily="JetBrains Mono Variable, monospace">R₄ · 360u</text>
      <text x="404" y="144" fill="var(--amber-dim)" fontSize="9" letterSpacing="1.5" fontFamily="JetBrains Mono Variable, monospace">R₃ · 260u</text>
      <text x="404" y="244" fill="var(--amber-dim)" fontSize="9" letterSpacing="1.5" fontFamily="JetBrains Mono Variable, monospace">R₂ · 160u</text>
      <text x="404" y="324" fill="var(--amber-dim)" fontSize="9" letterSpacing="1.5" fontFamily="JetBrains Mono Variable, monospace">R₁ · 080u</text>
    </svg>
  );
}
