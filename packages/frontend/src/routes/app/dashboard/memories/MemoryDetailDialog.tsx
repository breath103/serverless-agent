import { Dialog } from "radix-ui";
import { useCallback, useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { useRepositoryQuery } from "@/contexts/RepositoryContext";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import { MemoryDetailBody } from "./MemoryDetailBody";

export function MemoryDetailDialog({ memoryId }: { memoryId: string | undefined }) {
  const navigate = useNavigate();
  const close = () => void navigate({ to: "/dashboard/memories" });

  return (
    <Dialog.Root
      modal={false}
      open={!!memoryId}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        {memoryId ? <DialogShell memoryId={memoryId} onClose={close} /> : null}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Keyed on memoryId upstream so drafts reset when switching between memories.
function DialogShell({ memoryId, onClose }: { memoryId: string; onClose: () => void }) {
  const [fullScreen, setFullScreen] = useState(false);
  const { ref, onResizeStart } = useResizableWidth({
    storageKey: "memory-detail-width",
    defaultWidth: 560,
    minWidth: 400,
    // Cap at 80% of viewport so sidebar + some list stay visible behind.
    maxRatio: 0.8,
  });

  return (
    <Dialog.Content
      ref={ref}
      onInteractOutside={(e) => e.preventDefault()}
      onOpenAutoFocus={(e) => e.preventDefault()}
      className={cn(
        "fixed top-0 right-0 bottom-0 z-40",
        "flex flex-col",
        "border-l border-amber bg-background bloom-edge",
        // Only transition `left` (fullscreen toggle). `width` is mutated
        // directly by the drag handler — animating it would lag the cursor.
        "transition-[left] duration-250 ease-out",
        fullScreen && "left-60 w-auto!",
        "data-[state=closed]:animate-out data-[state=open]:animate-in",
        "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        "data-[state=closed]:ease-in data-[state=open]:ease-out",
        "data-[state=closed]:duration-180 data-[state=open]:duration-220",
      )}
    >
      {!fullScreen && <ResizeHandle onMouseDown={onResizeStart} />}
      <DetailLoader
        key={memoryId}
        memoryId={memoryId}
        fullScreen={fullScreen}
        onToggleFullScreen={() => setFullScreen((v) => !v)}
        onClose={onClose}
      />
    </Dialog.Content>
  );
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize memory panel"
      onMouseDown={onMouseDown}
      className={cn(
        "absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize",
        "transition-colors hover:bg-mint/35 active:bg-mint/55",
      )}
    />
  );
}

function DetailLoader({
  memoryId,
  fullScreen,
  onToggleFullScreen,
  onClose,
}: {
  memoryId: string;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
  onClose: () => void;
}) {
  const { entity, status } = useRepositoryQuery(
    "memories",
    { id: memoryId },
    useCallback(
      async () => await api.fetch("/api/memories/:id", "GET", { params: { id: memoryId } }),
      [memoryId],
    ),
  );
  if (status === "fetching" && !entity) return null;
  if (!entity) return <NotFound />;
  return (
    <MemoryDetailBody
      memory={entity}
      fullScreen={fullScreen}
      onToggleFullScreen={onToggleFullScreen}
      onClose={onClose}
    />
  );
}

function NotFound() {
  return (
    <div className="relative flex flex-col items-start gap-2 p-6">
      <Dialog.Title asChild>
        <h2 className="hud-title text-red" style={{ fontSize: "0.9375rem" }}>
          MEMORY NOT FOUND
        </h2>
      </Dialog.Title>
      <p className="hud-caption">
        THIS RECORD DOES NOT EXIST OR WAS DELETED.
      </p>
    </div>
  );
}
