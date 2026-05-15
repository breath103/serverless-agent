import { useState } from "react";

import { CircleNotchIcon } from "@phosphor-icons/react";

import { Skeleton } from "@/components/ui/skeleton";

import { MemoryContextMenu, type MemoryContextMenuState } from "./MemoryContextMenu";
import { MemoryRow } from "./MemoryRow";
import type { Memory } from "./types";

export function MemoryList({
  memories,
  status,
  hasMore,
  sentinelRef,
}: {
  memories: Memory[];
  status: "idle" | "fetching";
  hasMore: boolean;
  sentinelRef: (el: HTMLDivElement | null) => void;
}) {
  const [menu, setMenu] = useState<MemoryContextMenuState | null>(null);

  if (memories.length === 0 && status === "fetching") {
    return (
      <>
        <MemoryTableHeader />
        <RowSkeletons />
      </>
    );
  }
  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="hud-label">NO MEMORIES STORED</p>
        <p className="hud-caption">
          PRESS <span style={{ color: "var(--accent-1)" }}>[NEW]</span> TO INITIALIZE FIRST RECORD
        </p>
      </div>
    );
  }
  return (
    <>
      <MemoryTableHeader count={memories.length} />
      <div>
        {memories.map((m) => (
          <MemoryRow
            key={m.id}
            memory={m}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ id: m.id, x: e.clientX, y: e.clientY });
            }}
          />
        ))}
      </div>
      {hasMore && <div ref={sentinelRef} className="h-1" />}
      {hasMore && status === "fetching" && (
        <div
          className="flex items-center justify-center py-6 text-mint"
          style={{ fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase" }}
        >
          <CircleNotchIcon size={13} className="mr-2 animate-hud-tick" />
          LOADING MORE…
        </div>
      )}
      <MemoryContextMenu state={menu} onClose={() => setMenu(null)} />
    </>
  );
}

export function MemoryTableHeader({ count }: { count?: number }) {
  return (
    <div className="hud-subheader gap-4 px-8">
      <span className="hud-label">RECORDS [{count ?? "…"}]</span>
      <div className="ml-4 flex flex-1 items-center gap-4">
        <span className="flex-1 hud-label">TITLE</span>
        <span className="w-24 text-right hud-label">TIMESTAMP</span>
      </div>
    </div>
  );
}

function RowSkeletons() {
  return (
    <div className="divide-y divide-amber-hair">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex w-full items-center gap-4 px-8 py-2.5">
          <Skeleton className="h-4 min-w-0 flex-1" />
          <Skeleton className="h-3 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}
