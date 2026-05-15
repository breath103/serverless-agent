import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export type ContextMenuState = { x: number; y: number };

// Shared styles for floating menu surfaces and their rows. Kept in this
// file so the menu components own their own look — adding @utility
// entries to global.css for something used only by this module doesn't
// pay its way.
const surfaceClass = cn(
  "z-50 min-w-[180px] overflow-hidden border border-cream-hair bg-background p-0 bloom-edge",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out",
  "data-[state=open]:animate-in data-[state=open]:fade-in",
  "duration-120 data-[state=closed]:ease-in data-[state=open]:ease-out",
);

const itemClass = cn(
  "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left font-semibold uppercase outline-none",
  "text-text-1 transition-colors duration-100",
  "hover:bg-cream/10 data-highlighted:bg-cream/15",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
);

/** Styled container div for any floating menu. Used directly by
 *  `<ContextMenu>`; use via `asChild` for Radix DropdownMenu.Content etc.
 *  Animations fire when the consumer (or Radix) sets data-state. */
export function MenuSurface({
  children,
  ...rest
}: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn(surfaceClass, rest.className)}>{children}</div>;
}

/**
 * Portalled right-click menu shell. Handles positioning, click-outside /
 * Escape dismissal, and animation state. Callers render `<MenuItem>`
 * children; the shell itself doesn't know what actions you're offering.
 */
export function ContextMenu({
  state,
  onClose,
  children,
}: {
  state: ContextMenuState | null;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!state) return;
    const onDown = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  return createPortal(
    <MenuSurface
      style={{ position: "fixed", left: state.x, top: state.y }}
      onMouseDown={(e) => e.stopPropagation()}
      data-state="open"
    >
      {children}
    </MenuSurface>,
    document.body,
  );
}

/** A single clickable entry inside `<ContextMenu>` or (via Radix `asChild`)
 *  a DropdownMenu.Item. Icon + label.
 *
 *  Spreads remaining props (including `ref`) onto the underlying `<button>`
 *  so Radix's `asChild` pattern can attach the handlers that fire `onSelect`. */
export function MenuItem({
  icon: Icon,
  label,
  variant = "default",
  className,
  ref,
  ...rest
}: {
  icon?: PhosphorIcon;
  label: string;
  variant?: "default" | "destructive";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">
& { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      style={{ fontSize: "0.6875rem", letterSpacing: "0.08em" }}
      className={cn(
        itemClass,
        variant === "destructive" && "text-red hover:bg-red/12",
        className,
      )}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
}
