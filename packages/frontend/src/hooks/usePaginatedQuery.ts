import { useEffect, useMemo, useRef, useState } from "react";

import { useRepository } from "@/contexts/RepositoryContext";
import { useOnChange } from "@/hooks/useOnChange";

type EntityWithId = { id: string };

/**
 * Insert an entity into the correct position within pages, respecting sort order.
 * - If entity belongs before or within the loaded range, insert it in sorted position.
 * - If entity belongs after the last loaded item, ignore it (there may be unfetched records in between).
 */
function sortedInsert<Entity extends EntityWithId>(
  pages: Entity[][],
  entity: Entity,
  sort: (a: Entity, b: Entity) => number,
): Entity[][] {
  const flat = pages.flat();
  if (flat.length === 0) return [[entity]];

  // Find which page and position to insert
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    for (let i = 0; i < page.length; i++) {
      if (sort(entity, page[i]) <= 0) {
        const newPage = [...page];
        newPage.splice(i, 0, entity);
        return [...pages.slice(0, p), newPage, ...pages.slice(p + 1)];
      }
    }
  }

  // Entity goes at the end of the last page (still within range)
  const lastPage = pages[pages.length - 1];
  return [...pages.slice(0, -1), [...lastPage, entity]];
}

export function usePaginatedQuery<
  Table extends string,
  Entity extends EntityWithId,
  Param,
>(
  table: Table,
  param: Param,
  fetcher: (param: Param, after: string | null) => Promise<{
    data: Entity[];
    after: string | null;
  }>,
  options: {
    sort: (a: Entity, b: Entity) => number;
    filter?: (entity: Entity) => boolean;
    /** When "backward", new pages are prepended (for newest-first APIs loading older items). Default: "forward". */
    direction?: "forward" | "backward";
  },
) {
  const repository = useRepository();
  const [pages, setPages] = useState<Entity[][]>([]);
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "fetching">("idle");

  // Track serialized param for change detection
  const paramKey = JSON.stringify(param);
  // Track which IDs were fetched by us (to distinguish from external realtime inserts)
  const fetchedIdsRef = useRef(new Set<string>());

  const backward = options.direction === "backward";

  // Fetch a page and update state
  const fetchPage = useMemo(() => {
    return async (currentParam: Param, cursor: string | null, isLoadMore: boolean) => {
      setStatus("fetching");
      try {
        const result = await fetcher(currentParam, cursor);

        // Cache each entity in repository
        for (const entity of result.data) {
          fetchedIdsRef.current.add(entity.id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          repository.set(table as any, entity as any);
        }

        // For backward pagination, reverse page data so items are in sort order
        const pageData = backward ? [...result.data].reverse() : result.data;

        if (isLoadMore) {
          // Backward: older pages go before existing. Forward: newer pages go after.
          setPages((prev) => backward ? [pageData, ...prev] : [...prev, pageData]);
        } else {
          setPages([pageData]);
        }
        setAfterCursor(result.after);
      } finally {
        setStatus("idle");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher intentionally excluded
  }, [repository, table, backward]);

  // Reset and fetch first page when param changes
  useOnChange(() => {
    fetchedIdsRef.current = new Set();
    setPages([]);
    setAfterCursor(null);
    void fetchPage(param, null, false);
  }, [paramKey, fetchPage]);

  // Keep options refs current so the subscription closure always uses the latest
  const sortRef = useRef(options.sort);
  sortRef.current = options.sort;
  const filterRef = useRef(options.filter);
  filterRef.current = options.filter;

  // Subscribe to repository events for realtime updates
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events$ = repository.getEvents(table as any);
    const sub = events$.subscribe((event) => {
      setPages((prevPages) => {
        switch (event.type) {
          case "insert": {
            const newEntity = event.new as Entity;
            if (fetchedIdsRef.current.has(newEntity.id)) return prevPages;
            if (filterRef.current && !filterRef.current(newEntity)) return prevPages;
            fetchedIdsRef.current.add(newEntity.id);
            return sortedInsert(prevPages, newEntity, sortRef.current);
          }
          case "update": {
            const updated = event.new as Entity;
            // Remove old entry first
            const removed = prevPages.map((page) =>
              page.filter((item) => item.id !== updated.id),
            );
            // If updated entity no longer passes filter, just remove it
            if (filterRef.current && !filterRef.current(updated)) {
              fetchedIdsRef.current.delete(updated.id);
              return removed;
            }
            return sortedInsert(removed, updated, sortRef.current);
          }
          case "delete": {
            const deleted = event.old as Entity;
            fetchedIdsRef.current.delete(deleted.id);
            return prevPages.map((page) =>
              page.filter((item) => item.id !== deleted.id),
            );
          }
        }
      });
    });
    return () => sub.unsubscribe();
  }, [repository, table]);

  const records = useMemo(() => pages.flat(), [pages]);

  const loadMore = () => {
    if (afterCursor && status !== "fetching") {
      void fetchPage(param, afterCursor, true);
    }
  };

  return {
    records,
    status,
    hasMore: afterCursor !== null,
    loadMore,
  };
}
