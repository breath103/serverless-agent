import { useState } from "react";

import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export function MemorySearchInput({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const expanded = focused || query.length > 0;

  return (
    <label
      className={cn(
        "relative flex h-8 shrink-0 cursor-text items-center border transition-[width,border-color] duration-150",
        expanded
          ? "w-60 border-amber bg-background focus-within:border-mint"
          : "w-8 border-transparent hover:border-amber-dim",
      )}
    >
      <MagnifyingGlassIcon
        size={13}
        className="pointer-events-none absolute left-2 text-amber-dim"
      />
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={expanded ? "QUERY..." : undefined}
        className={cn(
          "size-full bg-transparent pl-7 text-xs uppercase outline-none placeholder:text-amber-dim",
          "text-amber tabular-nums",
          expanded ? "pr-7" : "cursor-pointer",
        )}
        style={{ letterSpacing: "0.06em" }}
      />
      {expanded && query && (
        <button
          type="button"
          aria-label="Clear search"
          onMouseDown={(e) => {
            e.preventDefault();
            onQueryChange("");
          }}
          className="absolute right-1 flex size-6 items-center justify-center text-amber-dim hover:text-amber"
        >
          <XIcon size={11} />
        </button>
      )}
    </label>
  );
}
