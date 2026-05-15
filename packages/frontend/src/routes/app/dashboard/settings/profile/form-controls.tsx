import { forwardRef, type SelectHTMLAttributes } from "react";

import { CaretDownIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="hud-label">{title}</h2>
        <p className="hud-caption">{hint}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="hud-label">{label}</span>
      {children}
    </label>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, className, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none border border-cream-hair bg-background px-3 pr-10 text-cream",
          "outline-none focus:border-cyan",
          "transition-colors duration-150",
          className,
        )}
        style={{ fontSize: "0.75rem", letterSpacing: "0.04em" }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <CaretDownIcon
        size={13}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-cream-dim"
      />
    </div>
  ),
);
Select.displayName = "Select";
