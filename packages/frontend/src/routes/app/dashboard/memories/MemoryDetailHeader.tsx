import { Dialog } from "radix-ui";
import { useMemo } from "react";

import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

import { MemoryDetailActions } from "./MemoryDetailActions";
import { MemoryTitleInput } from "./MemoryTitleInput";
import type { Memory } from "./types";

export function MemoryDetailHeader({
  memory,
  title,
  onTitleChange,
  onTitleBlur,
  fullScreen,
  onToggleFullScreen,
  onClose,
}: {
  memory: Memory;
  title: string;
  onTitleChange: (v: string) => void;
  onTitleBlur: () => void;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
  onClose: () => void;
}) {
  const createdAt = useMemo(() => new Date(memory.created_at), [memory.created_at]);

  return (
    <header
      className={cn(
        "flex items-start gap-3 border-b border-cream-hair px-6 pt-5 pb-4",
        fullScreen && "px-10",
      )}
    >
      <div className="min-w-0 flex-1 pr-16">
        <div className="mb-1 hud-eyebrow">MEMORY // RECORD</div>
        <Dialog.Title asChild>
          <MemoryTitleInput value={title} onChange={onTitleChange} onCommit={onTitleBlur} />
        </Dialog.Title>
        <div className="mt-1 flex items-center gap-2 hud-caption text-mint">
          <span aria-hidden>▪</span>
          <span>CREATED {relativeTime(createdAt).toUpperCase()}</span>
        </div>
      </div>
      <MemoryDetailActions
        memoryId={memory.id}
        fullScreen={fullScreen}
        onToggleFullScreen={onToggleFullScreen}
        onClose={onClose}
      />
    </header>
  );
}
