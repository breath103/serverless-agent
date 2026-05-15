import { cn } from "@/lib/utils";

// Structured hh:mm:ss input. Caller passes/receives a whole-second value;
// each unit is its own clamped number field with a ":" between. `onBlur`
// fires only when focus actually leaves the group — not when tabbing
// between its own fields.
export function DurationInput({
  value,
  onChange,
  onBlur,
}: {
  value: number;
  onChange: (seconds: number) => void;
  onBlur?: () => void;
}) {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) onBlur?.();
  };

  const emit = (h: number, m: number, s: number) => {
    onChange(Math.max(0, h * 3600 + m * 60 + s));
  };

  return (
    <div
      className="inline-flex items-center gap-1 text-sm"
      onBlur={handleBlur}
    >
      <Field label="hours" value={hours} min={0} onChange={(h) => emit(h, minutes, seconds)} />
      <Sep />
      <Field label="minutes" value={minutes} min={0} max={59} onChange={(m) => emit(hours, m, seconds)} />
      <Sep />
      <Field label="seconds" value={seconds} min={0} max={59} onChange={(s) => emit(hours, minutes, s)} />
    </div>
  );
}

function Field({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const clamped = max === undefined ? Math.max(min, n) : Math.min(max, Math.max(min, n));
        onChange(clamped);
      }}
      className={cn(
        "w-10 border border-cream-hair bg-transparent px-1.5 py-1 text-center text-sm text-cream tabular-nums",
        "transition-colors outline-none",
        "hover:border-cream-dim focus:border-cyan",
        "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        "[-moz-appearance:textfield]",
      )}
    />
  );
}

function Sep() {
  return <span className="text-cream-dim tabular-nums">:</span>;
}
