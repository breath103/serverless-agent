import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import { MemoryContentEditor } from "./MemoryContentEditor";
import { MemoryDetailHeader } from "./MemoryDetailHeader";
import type { Memory } from "./types";

const CONTENT_DEBOUNCE_MS = 800;

export function MemoryDetailBody({
  memory,
  fullScreen,
  onToggleFullScreen,
  onClose,
}: {
  memory: Memory;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
  onClose: () => void;
}) {
  // Local drafts. Parent re-keys on memoryId so these reset on switch.
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);

  // Content auto-save: debounce writes so we don't PATCH on every keystroke.
  useEffect(() => {
    if (content === memory.content) return;
    const id = setTimeout(() => {
      void api.fetch("/api/memories/:id", "PATCH", {
        params: { id: memory.id },
        body: { content },
      });
    }, CONTENT_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [content, memory.id, memory.content]);

  const saveTitle = () => {
    const next = title.trim() || "Untitled";
    if (next === memory.title) return;
    setTitle(next);
    void api.fetch("/api/memories/:id", "PATCH", {
      params: { id: memory.id },
      body: { title: next },
    });
  };

  return (
    <>
      <MemoryDetailHeader
        memory={memory}
        title={title}
        onTitleChange={setTitle}
        onTitleBlur={saveTitle}
        fullScreen={fullScreen}
        onToggleFullScreen={onToggleFullScreen}
        onClose={onClose}
      />
      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto",
          // Extra left padding absorbs the BN block-handle overhang so it
          // stays inside the dialog; text visually aligns with the title.
          fullScreen ? "py-8 pr-10 pl-16" : "py-5 pr-6 pl-14",
        )}
      >
        <MemoryContentEditor initialMarkdown={memory.content} onChange={setContent} />
      </div>
    </>
  );
}
