import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { CircleNotchIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

import styles from "./button.module.css";

// Variant maps to a `data-variant` attribute the CSS module reads (so the color
// rules live in one place). All variants share the same chrome — terminal-HUD
// buttons are uniform; the only per-variant difference is hue + dashed-vs-solid
// border style.
const buttonVariants = cva(
  `${styles.button} relative inline-flex items-center justify-center whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-50`,
  {
    variants: {
      size: {
        sm: "h-8 gap-1.5 px-3 text-[0.6875rem]",
        default: "h-10 gap-2 px-4 text-xs",
        lg: "h-12 gap-2 px-6 text-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

type Variant = "default" | "primary" | "secondary" | "destructive";

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    variant?: Variant;
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  variant = "default",
  size,
  asChild = false,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const mergedClassName = cn(
    buttonVariants({ size, className }),
    loading && "disabled:opacity-100",
  );

  if (asChild) {
    return (
      <Slot.Root data-variant={variant} className={mergedClassName} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-variant={variant}
      aria-busy={loading || undefined}
      disabled={disabled ?? loading}
      className={mergedClassName}
      {...props}
    >
      <span className={cn("contents", loading && "invisible")}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <CircleNotchIcon size={14} weight="bold" className="animate-hud-tick" />
        </span>
      )}
    </button>
  );
}
