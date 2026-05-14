import { useEffect, useState } from "react";

import { useRepository } from "@/contexts/RepositoryContext";
import { useMutation } from "@/hooks/useMutation";
import { api } from "@/lib/api";

import { MemoryContextMenu, type MemoryContextMenuState } from "./MemoryContextMenu";
import { MemoryTableHeader } from "./MemoryList";
import { MemoryRow } from "./MemoryRow";

export function MemorySearchResults({ query }: { query: string }) {
  const [menu, setMenu] = useState<MemoryContextMenuState | null>(null);
  const repository = useRepository();
  const search = useMutation(
    async (q: string) =>
      await api.fetch("/api/memories/search", "GET", { query: { q, limit: 100 } }),
    [],
  );

  useEffect(() => {
    void search.call(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search.call identity changes break this
  }, [query]);

  if (search.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="hud-label text-red">! {search.error.message}</p>
      </div>
    );
  }
  if (search.status !== "success") return null;
  const results = search.result;
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="hud-label">NO MATCHES FOR &ldquo;{query.toUpperCase()}&rdquo;</p>
      </div>
    );
  }
  return (
    <>
      <MemoryTableHeader count={results.length} />
      <div>
        {results.map((match) => {
          const mem = repository.get("memories", { id: match.id });
          if (!mem) return null;
          return (
            <MemoryRow
              key={match.id}
              memory={mem}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ id: mem.id, x: e.clientX, y: e.clientY });
              }}
            />
          );
        })}
      </div>
      <MemoryContextMenu state={menu} onClose={() => setMenu(null)} />
    </>
  );
}
