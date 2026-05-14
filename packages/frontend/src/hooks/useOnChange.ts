import type { DependencyList } from "react";
import { useEffect, useRef } from "react";

/**
 * Runs callback once per unique dependency values.
 * For fire-and-forget effects without cleanup.
 * Prevents React 18 Strict Mode from double-firing.
 */
export function useOnChange(callback: () => void | Promise<void>, deps: DependencyList) {
  const lastDeps = useRef<DependencyList | null>(null);

  useEffect(() => {
    if (lastDeps.current && depsEqual(lastDeps.current, deps)) return;
    lastDeps.current = deps;
    void callback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function depsEqual(a: DependencyList, b: DependencyList) {
  return a.length === b.length && a.every((dep, i) => Object.is(dep, b[i]));
}
