import { useState } from "react";

import { PlusIcon } from "@phosphor-icons/react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useDebounced } from "@/hooks/useDebounced";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api } from "@/lib/api";
import { PageShell } from "@/routes/app/PageShell";

import { CreateMemoryModal } from "./CreateMemoryModal";
import { MemoryDetailDialog } from "./MemoryDetailDialog";
import { MemoryList } from "./MemoryList";
import { MemorySearchInput } from "./MemorySearchInput";
import { MemorySearchResults } from "./MemorySearchResults";

const PAGE_SIZE = 50;

export function MemoryPage() {
  const navigate = useNavigate();
  const activeMemoryId = useRouterState({
    select: (s) => s.location.pathname.match(/^\/dashboard\/memories\/([^/]+)$/)?.[1],
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 400);

  const { records, status, hasMore, loadMore } = usePaginatedQuery(
    "memories",
    undefined,
    async (_, before) => {
      const data = await api.fetch("/api/memories", "GET", {
        query: { limit: PAGE_SIZE, before: before ?? undefined },
      });
      return {
        data,
        after: data.length >= PAGE_SIZE ? data[data.length - 1].created_at : null,
      };
    },
    {
      sort: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    },
  );

  const sentinelRef = useInfiniteScroll({
    hasMore,
    loading: status === "fetching",
    onLoadMore: loadMore,
  });

  return (
    <PageShell
      title="Memory"
      channel="magenta"
      eyebrow="DASHBOARD // MEMORY"
      actions={(
        <>
          <MemorySearchInput query={query} onQueryChange={setQuery} />
          <Button onClick={() => setCreateOpen(true)} size="sm" variant="primary">
            <PlusIcon size={13} weight="bold" />
            <span>NEW</span>
          </Button>
        </>
      )}
    >
      {debounced.length > 0 ? (
        <MemorySearchResults query={debounced} />
      ) : (
        <MemoryList
          memories={records}
          status={status}
          hasMore={hasMore}
          sentinelRef={sentinelRef}
        />
      )}
      <MemoryDetailDialog memoryId={activeMemoryId} />
      <CreateMemoryModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          void navigate({ to: "/dashboard/memories/$memoryId", params: { memoryId: id } });
        }}
      />
    </PageShell>
  );
}
