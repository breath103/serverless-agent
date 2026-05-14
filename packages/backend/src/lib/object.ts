/** Typed Object.entries — preserves value type from Record<K, V>. */
export function entries<K extends string, V>(obj: Record<K, V>): [K, V][] {
  return Object.entries(obj) as [K, V][];
}

/** Map values of a record, preserving keys. */
export function mapValues<V, U>(obj: Record<string, V>, fn: (value: V, key: string) => U): Record<string, U> {
  return Object.fromEntries(entries(obj).map(([k, v]) => [k, fn(v, k)])) as Record<string, U>;
}
