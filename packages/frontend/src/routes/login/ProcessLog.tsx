import { useEffect, useState } from "react";

// Fake TLS handshake stream. Prints one line at a time at startup and stops
// on the final "AWAITING CREDENTIALS_" so the cursor blink is the last
// thing the user sees. Pure decoration — none of this is real.

const STAGES: ReadonlyArray<string> = [
  "SOCKET OPEN :: 0.0.0.0:443 → core-edge-7",
  "TLS-1.3 HANDSHAKE INITIATED",
  "CIPHER NEGOTIATED · TLS_AES_256_GCM_SHA384",
  "CERT VERIFIED · fp a3:1f:88:c0:ff:ee",
  "SESSION CONTEXT ALLOCATED · slot 0x07",
  "ENTROPY POOL OK · 4096 bits",
  "GEO RESOLVED · node us-west-2c",
  "AUTH STRATEGY · USERNAME + PASSPHRASE",
  "READY :: AWAITING CREDENTIALS",
];

const STEP_MS = 240;

export function ProcessLog() {
  const lines = useStreamingLines(STAGES, STEP_MS);
  return (
    <div
      className="pointer-events-none absolute bottom-12 left-8 hidden md:block"
      style={{ width: "min(440px, 32vw)" }}
      aria-hidden
    >
      <div className="mb-1.5 hud-eyebrow">PROCESS LOG // PRE-AUTH</div>
      <ul
        className="font-mono"
        style={{ fontSize: "0.625rem", letterSpacing: "0.02em", lineHeight: 1.7 }}
      >
        {lines.map((l, i) => {
          const isLast = i === lines.length - 1;
          const done = lines.length === STAGES.length;
          return (
            <li
              key={i}
              className={isLast && done ? "text-mint" : "text-amber-dim"}
            >
              <span className="text-amber-hair">&gt;</span>
              <span className="ml-2 text-amber-hair tabular-nums">{l.ts}</span>
              <span className="ml-2">{l.text}</span>
              {isLast && done && (
                <span className="ml-1 animate-hud-blink text-mint">_</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function useStreamingLines(stages: ReadonlyArray<string>, stepMs: number) {
  const [lines, setLines] = useState<{ ts: string; text: string }[]>([]);
  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      if (i >= stages.length) {
        window.clearInterval(id);
        return;
      }
      const stage = stages[i];
      i += 1;
      // setState in a callback (interval tick) is fine — the lint rule only
      // forbids synchronous setState in the effect body itself.
      setLines((prev) => [...prev, { ts: stamp(), text: stage }]);
    }, stepMs);
    return () => window.clearInterval(id);
  }, [stages, stepMs]);
  return lines;
}

function stamp(): string {
  const d = new Date();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}
