import { Dialog } from "radix-ui";

import { ArrowsInSimpleIcon, ArrowsOutSimpleIcon, XIcon } from "@phosphor-icons/react";

import { MemoryMoreMenu } from "./MemoryActions";

export function MemoryDetailActions({
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
  return (
    <div className="absolute top-3.5 right-3.5 flex items-center gap-1">
      <button
        type="button"
        onClick={onToggleFullScreen}
        aria-label={fullScreen ? "Collapse" : "Expand"}
        className="icon-ghost-button size-8"
      >
        {fullScreen ? <ArrowsInSimpleIcon size={16} /> : <ArrowsOutSimpleIcon size={16} />}
      </button>
      <MemoryMoreMenu memoryId={memoryId} onDeleted={onClose} />
      <Dialog.Close asChild>
        <button type="button" aria-label="Close" className="icon-ghost-button size-8">
          <XIcon size={16} />
        </button>
      </Dialog.Close>
    </div>
  );
}
