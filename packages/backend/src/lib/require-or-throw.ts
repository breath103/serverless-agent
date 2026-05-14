/**
 * Narrow a nullable value to non-nullable or throw the error from the
 * factory. Lets repos stay pure-data (return `T | null`) while route
 * handlers decide the HTTP status / message at the callsite.
 *
 * ```ts
 * const m = requireOrThrow(
 *   await memoriesRepo.getById(user.id, id),
 *   () => new HTTPException(404, { message: "Memory not found" }),
 * );
 * ```
 *
 * The error factory is called lazily so the `new HTTPException` cost
 * (and any message formatting) only happens on the miss path.
 */
export function requireOrThrow<T>(value: T | null | undefined, error: () => Error): T {
  if (value == null) throw error();
  return value;
}
