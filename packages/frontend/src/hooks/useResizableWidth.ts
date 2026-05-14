import { useCallback, useEffect, useRef } from "react";
import { z } from "zod";

import { useLocalStorageState } from "./useLocalStorageState";

// Right-edge-anchored panel resize. Mutates the ref's inline width directly
// during drag (no React re-renders per mousemove), persists to localStorage
// only on mouseup, clamps to a fraction of viewport width. Caller attaches
// `ref` to the element being resized and wires `onResizeStart` to the
// handle's onMouseDown.
export function useResizableWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxRatio,
}: {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxRatio: number;
}) {
  const [persistedWidth, setPersistedWidth] = useLocalStorageState(
    storageKey,
    z.number().int().min(minWidth),
    defaultWidth,
  );
  const ref = useRef<HTMLDivElement | null>(null);

  // Reflect persisted width onto the DOM when it changes externally
  // (mount, clamp, programmatic set).
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.width = `${persistedWidth}px`;
  }, [persistedWidth]);

  // Clamp on mount if viewport shrank since last visit.
  useEffect(() => {
    const max = Math.floor(window.innerWidth * maxRatio);
    if (persistedWidth > max) setPersistedWidth(max);
  }, [persistedWidth, setPersistedWidth, maxRatio]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    let latest = persistedWidth;
    const onMove = (ev: MouseEvent) => {
      const max = Math.floor(window.innerWidth * maxRatio);
      latest = Math.max(minWidth, Math.min(window.innerWidth - ev.clientX, max));
      if (ref.current) ref.current.style.width = `${latest}px`;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      setPersistedWidth(latest);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  }, [persistedWidth, setPersistedWidth, minWidth, maxRatio]);

  return { ref, onResizeStart };
}
