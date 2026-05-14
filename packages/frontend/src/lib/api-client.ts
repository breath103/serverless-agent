// Check if a type is never
type IsNever<T> = [T] extends [never] ? true : false;

// Routes shape from backend's ExtractRoutes
/* eslint-disable @typescript-eslint/no-restricted-types */
type Routes = {
  [path: string]: {
    [method: string]: {
      params: unknown;
      query: unknown;
      body: unknown;
      response: unknown;
    };
  };
};
/* eslint-enable @typescript-eslint/no-restricted-types */

// Build options type based on what the route needs
/* eslint-disable @typescript-eslint/no-restricted-types */
type FetchOptions<T> = (IsNever<T extends { params: infer P } ? P : never> extends true
  ? unknown
  : { params: T extends { params: infer P } ? P : never }) &
  (IsNever<T extends { query: infer Q } ? Q : never> extends true
    ? unknown
    : { query: T extends { query: infer Q } ? Q : never }) &
    (IsNever<T extends { body: infer B } ? B : never> extends true
      ? unknown
      : { body: T extends { body: infer B } ? B : never });
/* eslint-enable @typescript-eslint/no-restricted-types */

// Check if options are required
type HasRequired<T> = IsNever<T extends { params: infer P } ? P : never> extends true
  ? IsNever<T extends { query: infer Q } ? Q : never> extends true
    ? IsNever<T extends { body: infer B } ? B : never> extends true
      ? false
      : true
    : true
  : true;

// API client class
export class ApiClient<T extends Routes> {
  constructor(private baseUrl = "", private defaultHeaders: Record<string, string> = {}) {}

  async fetch<P extends keyof T & string, M extends keyof T[P] & string>(
    ...args: HasRequired<T[P][M]> extends true
      ? [path: P, method: M, options: FetchOptions<T[P][M]>]
      : [path: P, method: M, options?: FetchOptions<T[P][M]>]
  ): Promise<T[P][M] extends { response: infer R } ? R : never> {
    const [path, method, options] = args as [string, string, {
      params?: Record<string, string | number>;
      // eslint-disable-next-line @typescript-eslint/no-restricted-types
      query?: Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-restricted-types
      body?: Record<string, unknown>;
    }?];

    // Replace path params
    let url = path;
    if (options?.params) {
      url = path.replace(/:(\w+)/g, (_, key: string) => {
        const value = options.params![key];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime safety for missing params
        if (value === undefined) throw new Error(`Missing param: ${key}`);
        return encodeURIComponent(String(value));
      });
    }

    // Add query string
    if (options?.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          params.append(key, typeof value === "object" ? JSON.stringify(value) : `${value as string | number | boolean}`);
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const response = await fetch(`${this.baseUrl}${url}`, {
      method,
      headers: { "Content-Type": "application/json", ...this.defaultHeaders },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" })) as { error?: string };
      throw new Error(error.error ?? `HTTP ${response.status}`);
    }

    return response.json() as Promise<T[P][M] extends { response: infer R } ? R : never>;
  }
}
