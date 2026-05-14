import { Link } from "@tanstack/react-router";

import type { Memory } from "./types";

export function MemoryRow({
  memory,
  onContextMenu,
}: {
  memory: Memory;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <Link
      to="/dashboard/memories/$memoryId"
      params={{ memoryId: memory.id }}
      onContextMenu={onContextMenu}
      className="flex w-full items-center gap-4 selectable-button-accent-1 px-8 py-2 text-left"
    >
      <span aria-hidden className="size-1.5 shrink-0 bg-mint" />
      <div
        className="min-w-0 flex-1 truncate font-semibold uppercase"
        style={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}
      >
        {memory.title}
      </div>

      <time
        className="w-24 shrink-0 text-right text-mint tabular-nums"
        style={{ fontSize: "0.6875rem", letterSpacing: "0.04em" }}
      >
        {formatTimestamp(new Date(memory.created_at))}
      </time>
    </Link>
  );
}

function formatTimestamp(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const sameYear = yyyy === new Date().getFullYear();
  return sameYear ? `${mm}-${dd}` : `${yyyy}-${mm}-${dd}`;
}
