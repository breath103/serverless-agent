import { HoverCard } from "radix-ui";
import { type ReactNode, useCallback } from "react";

import { Link } from "@tanstack/react-router";

import { MarkdownBlock } from "@/components/MarkdownBlock";
import { useRepositoryQuery } from "@/contexts/RepositoryContext";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/relative-time";

/**
 * Generic reference to a user-visible resource that the agent (or any future
 * tool) might surface. `kind` drives both the hover-card preview renderer and
 * the click destination. Add a new variant here to extend the system.
 */
export type ResourceRef =
  | { kind: "memory"; id: string };

/**
 * Wraps row contents with a hover-card preview + click-to-navigate.
 *
 * Keep this component render-agnostic — callers pass in the row body as
 * children, and ResourceRow layers on hover/navigation. That way a skill-call
 * result row, a future search-result row, and a reference inside an agent
 * message can all share the same preview/navigation machinery.
 */
export function ResourceRow({
  resource,
  className,
  children,
}: {
  resource: ResourceRef;
  className?: string;
  children: ReactNode;
}) {
  return (
    <HoverCard.Root openDelay={120} closeDelay={80}>
      <HoverCard.Trigger asChild>
        <Link to="/dashboard/memories/$memoryId" params={{ memoryId: resource.id }} className={className}>
          {children}
        </Link>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 w-80 rounded-md border border-border bg-surface-secondary p-4 shadow-xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <ResourcePreview resource={resource} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

/**
 * Dispatches on resource kind. Each preview is responsible for fetching
 * whatever it needs — the hover-card content only mounts on open, so fetches
 * are lazy and cached through RepositoryContext.
 */
export function ResourcePreview({ resource }: { resource: ResourceRef }) {
  return <MemoryPreview id={resource.id} />;
}

function MemoryPreview({ id }: { id: string }) {
  const { entity: memory, status } = useRepositoryQuery(
    "memories",
    { id },
    useCallback(
      async () => await api.fetch("/api/memories/:id", "GET", { params: { id } }),
      [id],
    ),
  );
  if (!memory) return <PreviewState label={status === "fetching" ? "Loading…" : "Memory not found"} />;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-sm font-semibold tracking-tight text-text-1">
        {memory.title}
      </div>
      {memory.content && (
        <div className="relative max-h-40 overflow-hidden text-xs/relaxed text-text-2 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:font-semibold">
          <MarkdownBlock text={memory.content} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-surface-secondary to-transparent" />
        </div>
      )}
      <time className="text-[11px] text-text-3">{relativeTime(new Date(memory.created_at))}</time>
    </div>
  );
}

function PreviewState({ label }: { label: string }) {
  return <div className="text-xs text-text-3 italic">{label}</div>;
}
