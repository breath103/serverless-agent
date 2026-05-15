import { CheckCircleIcon, FloppyDiskIcon, PlusIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Typewriter } from "@/components/ui/typewriter";

// ── COLOR ────────────────────────────────────────────────────────────────
export function ColorsSection() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Swatch name="amber" varName="--amber" />
      <Swatch name="amber-dim" varName="--amber-dim" />
      <Swatch name="amber-hair" varName="--amber-hair" />
      <Swatch name="mint" varName="--mint" />
      <Swatch name="mint-dim" varName="--mint-dim" />
      <Swatch name="bg-elev" varName="--bg-elev" />
      <Swatch name="red" varName="--red" />
      <Swatch name="red-dim" varName="--red-dim" />
      <Swatch name="bg" varName="--bg" />
    </div>
  );
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex items-center gap-3 border border-amber-hair p-3">
      <div className="size-10 border border-amber-hair" style={{ background: `var(${varName})` }} />
      <div>
        <div className="hud-label">{name}</div>
        <div className="font-mono hud-caption">{varName}</div>
      </div>
    </div>
  );
}

// ── TYPOGRAPHY ───────────────────────────────────────────────────────────
export function TypographySection() {
  return (
    <div className="flex flex-col gap-3 border border-amber-hair p-5">
      <div className="hud-eyebrow">EYEBROW · 11PX · DIM AMBER · 0.14 LS</div>
      <div className="hud-label">HUD-LABEL · 12PX · BRIGHT AMBER · 0.10 LS</div>
      <div className="hud-title">HUD-TITLE · 30PX · UPPER · 0.04 LS</div>
      <div className="hud-display">HUD-DISPLAY · 44PX</div>
      <div className="hud-caption">HUD-CAPTION · 11PX · DIM AMBER</div>
      <div className="hud-mono-data">hud-mono-data · 14px · lowercase data values</div>
      <div className="text-amber" style={{ fontSize: "0.875rem" }}>
        body text — primary amber, 14px, mixed case for narrative copy
      </div>
      <div>
        <Typewriter text="TYPEWRITER WITH CURSOR" cursor speed={26} />
      </div>
      <div>
        <Typewriter text="TYPEWRITER NO CURSOR" speed={26} />
      </div>
    </div>
  );
}

// ── BUTTONS ──────────────────────────────────────────────────────────────
export function ButtonsSection() {
  return (
    <div className="flex flex-col gap-5">
      <Row label="DEFAULT (AMBER OUTLINE)">
        <Button variant="default" size="sm">SMALL</Button>
        <Button variant="default" size="default">DEFAULT</Button>
        <Button variant="default" size="lg">LARGE</Button>
        <Button variant="default" disabled>DISABLED</Button>
        <Button variant="default" loading>LOADING</Button>
      </Row>
      <Row label="PRIMARY (FILLED MINT)">
        <Button variant="primary" size="sm"><FloppyDiskIcon size={13} weight="bold" />SAVE</Button>
        <Button variant="primary"><PlusIcon size={14} weight="bold" />NEW</Button>
        <Button variant="primary" size="lg">AUTHENTICATE</Button>
        <Button variant="primary" disabled>DISABLED</Button>
        <Button variant="primary" loading>LOADING</Button>
      </Row>
      <Row label="SECONDARY (MINT OUTLINE)">
        <Button variant="secondary">CANCEL</Button>
        <Button variant="secondary" size="sm"><CheckCircleIcon size={13} weight="bold" />OK</Button>
      </Row>
      <Row label="DESTRUCTIVE (RED OUTLINE)">
        <Button variant="destructive">DELETE</Button>
        <Button variant="destructive" size="sm">DEL</Button>
      </Row>
    </div>
  );
}

// ── INPUTS ───────────────────────────────────────────────────────────────
export function InputsSection() {
  return (
    <div className="flex flex-col gap-4 border border-amber-hair p-5">
      <Field label="DEFAULT"><Input placeholder="Username" /></Field>
      <Field label="WITH VALUE"><Input defaultValue="user@example.com" /></Field>
      <Field label="INVALID"><Input aria-invalid="true" defaultValue="bad input" /></Field>
      <Field label="DISABLED"><Input disabled defaultValue="disabled" /></Field>
      <Field label="TEXTAREA"><Textarea rows={4} placeholder="Multiline notes…" /></Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="hud-label">{label}</span>
      {children}
    </label>
  );
}

// ── SELECTABLE ROWS ──────────────────────────────────────────────────────
export function SelectableSection() {
  return (
    <div className="flex flex-col gap-2 border border-amber-hair p-3">
      <p className="mb-1 hud-caption">
        AMBER (ACCENT-1). FIRST IS DEFAULT, SECOND IS DATA-SELECTED, THIRD IS DISABLED. HOVER REAL ROWS TO SEE TINT.
      </p>
      <SelectableRow>DEFAULT ROW</SelectableRow>
      <SelectableRow selected>SELECTED ROW (INVERTED, NO BLUR)</SelectableRow>
      <SelectableRow disabled>DISABLED ROW</SelectableRow>

      <p className="mt-3 mb-1 hud-caption">MINT (ACCENT-2)</p>
      <SelectableRow accent={2}>DEFAULT</SelectableRow>
      <SelectableRow accent={2} selected>SELECTED</SelectableRow>

      <p className="mt-3 mb-1 hud-caption">RED (ACCENT-3)</p>
      <SelectableRow accent={3}>DEFAULT</SelectableRow>
      <SelectableRow accent={3} selected>SELECTED</SelectableRow>
    </div>
  );
}

function SelectableRow({
  children,
  selected,
  disabled,
  accent = 1,
}: {
  children: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  accent?: 1 | 2 | 3;
}) {
  const cls = accent === 1
    ? "selectable-button-accent-1"
    : accent === 2
      ? "selectable-button-accent-2"
      : "selectable-button-accent-3";
  return (
    <button
      type="button"
      data-selected={selected || undefined}
      disabled={disabled}
      className={`${cls} flex items-center px-4 py-2 text-left text-amber disabled:opacity-40`}
      style={{ fontSize: "0.75rem", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}
    >
      {children}
    </button>
  );
}

// ── PANELS ───────────────────────────────────────────────────────────────
export function PanelsSection() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="hud-panel">
        <div className="mb-1 hud-label">DEFAULT (AMBER)</div>
        <div className="hud-caption">hud-panel — bordered amber container with edge bloom.</div>
      </div>
      <div className="hud-panel hud-panel-op">
        <div className="mb-1 hud-label">OPERATIONAL (MINT)</div>
        <div className="hud-caption">hud-panel-op — operational subsystem.</div>
      </div>
      <div className="hud-panel hud-panel-down">
        <div className="mb-1 hud-label">FAILURE (RED)</div>
        <div className="hud-caption">hud-panel-down — system in failure state.</div>
      </div>
    </div>
  );
}

// ── STATUS ICONS ─────────────────────────────────────────────────────────
export function IconsSection() {
  return (
    <div className="flex items-center gap-6 border border-amber-hair p-5">
      <StatusBadge color="text-mint" shape="■" label="OPERATIONAL" />
      <StatusBadge color="text-amber" shape="▲" label="DEGRADED" />
      <StatusBadge color="text-red" shape="●" label="FAILURE" />
      <StatusBadge color="text-amber-dim" shape="▫" label="UNKNOWN" />
    </div>
  );
}

function StatusBadge({ color, shape, label }: { color: string; shape: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={color} aria-hidden style={{ fontSize: "1.125rem" }}>{shape}</span>
      <span className="hud-label">{label}</span>
    </div>
  );
}

// ── ANIMATIONS ───────────────────────────────────────────────────────────
export function AnimationsSection() {
  return (
    <div className="flex items-center gap-8 border border-amber-hair p-5">
      <div className="flex items-center gap-2">
        <span className="animate-hud-blink text-mint" aria-hidden style={{ fontSize: "1rem" }}>▪</span>
        <span className="hud-label">HUD-BLINK · 1HZ STEPPED</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block animate-hud-tick text-mint" style={{ fontSize: "1rem" }}>↻</span>
        <span className="hud-label">HUD-TICK · STEPS(8)</span>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 hud-eyebrow">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
