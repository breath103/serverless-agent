import { useCallback, useEffect, useRef } from "react";

// Returns a ref to attach to a sentinel element. When the sentinel scrolls
// into view (and we have more pages and aren't currently loading), `onLoadMore`
// fires. The IntersectionObserver is rebuilt when `hasMore`/`loading` flips so
// the closure always sees the current values.
export function useInfiniteScroll({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const setRef = useCallback((el: HTMLDivElement | null) => {
    sentinelRef.current = el;
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  return setRef;
}
