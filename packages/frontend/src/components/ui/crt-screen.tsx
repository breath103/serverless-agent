import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import styles from "./crt-screen.module.css";

// Wrap the app to overlay the CRT effects (scanlines + edge vignette) onto
// everything inside. Both effects are `position: fixed` overlays at high
// z-index, so the wrapper itself doesn't need to fill the viewport — any
// ancestor of the app gets the full-screen effect.
//
// Tuning knobs live on `:root` in global.css: --scanline-opacity,
// --vignette-intensity.
export function CrtScreen({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(styles.screen, className)}>{children}</div>;
}
