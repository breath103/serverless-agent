import { Clock } from "@/components/ui/clock";
import { Typewriter } from "@/components/ui/typewriter";

export function LoginHeader() {
  return (
    <header>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 hud-eyebrow">
            <span>SERVERLESS // AGENT</span>
            <span className="animate-hud-blink text-mint" aria-hidden>▪</span>
            <span className="text-mint" style={{ letterSpacing: "0.14em" }}>
              SYSTEM ONLINE
            </span>
          </div>
          <h1 className="mt-1 hud-title">
            <Typewriter text="ACCESS TERMINAL" speed={32} cursor />
          </h1>
        </div>
        <div className="text-right">
          <div className="hud-eyebrow">PRIVATE ACCESS</div>
          <Clock
            precision="millisecond"
            className="mt-1 text-mint tabular-nums"
            style={{ fontSize: "0.75rem", letterSpacing: "0.04em" }}
          />
        </div>
      </div>
      <div className="mt-3 hud-rule" />
    </header>
  );
}

export function LoginFooter() {
  return (
    <footer className="mt-4 hud-caption text-text-2">
      © 2026 SERVERLESS AGENT — ALL RIGHTS RESERVED
    </footer>
  );
}
