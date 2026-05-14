import { cn } from "@/lib/utils";

// Pulse-animated placeholder block. Mirror the row's column widths in
// list-screen skeletons so layout doesn't jump when real rows arrive.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted/60", className)} />;
}
