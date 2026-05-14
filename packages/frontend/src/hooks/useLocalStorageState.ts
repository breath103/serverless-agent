import { useEffect, useState } from "react";
import superjson from "superjson";
import type { z } from "zod";

// localStorage-backed state with zod validation and a typed default.
// Reads synchronously on mount so the UI doesn't flash the default value.
// Uses superjson so Date/Map/Set etc. round-trip correctly.
export function useLocalStorageState<T>(
  key: string,
  schema: z.ZodType<T>,
  defaultValue: T,
) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    try {
      const parsed = schema.safeParse(superjson.parse(raw));
      return parsed.success ? parsed.data : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, superjson.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
