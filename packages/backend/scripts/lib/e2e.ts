/**
 * Shared helpers for `e2e_*.ts` harnesses. Keep this file dependency-light —
 * only `node:` and `node-fetch`-shaped APIs. Backend-runtime imports belong
 * in the harness scripts themselves.
 */

// eslint-disable-next-line @typescript-eslint/no-restricted-types -- assertion helper accepts any truthy/falsy
export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

export async function loginAsUser(baseUrl: string, username: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = /sa_session=([^;]+)/.exec(setCookie);
  assert(match, "no sa_session cookie returned from sign-in");
  return `sa_session=${match[1]}`;
}

export async function waitFor(check: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("waitFor: timed out");
}
