import fs from "node:fs";
import path from "node:path";

import { loadConfig, namespace, portOffset } from "shared/config";

const config = loadConfig();

// Per-worktree namespace — same as DDB / future per-checkout resources.
export const NAMESPACE = namespace(config);
// CDP port offset from a 9222 base so each worktree's headless Chrome
// lands on its own port without explicit config.
export const CDP_PORT = 9222 + portOffset(NAMESPACE);

const E2E_STATUS_FILE = path.join(process.cwd(), `.e2e-status-${NAMESPACE}.json`);

export interface E2eStatus {
  cdpEndpoint: string;
  pid: number;
}

export function read(): E2eStatus | null {
  try {
    return JSON.parse(fs.readFileSync(E2E_STATUS_FILE, "utf-8"));
  } catch {
    return null;
  }
}

export function write(s: E2eStatus) {
  fs.writeFileSync(E2E_STATUS_FILE, JSON.stringify(s, null, 2) + "\n");
}

export function remove() {
  try { fs.unlinkSync(E2E_STATUS_FILE); } catch { /* already gone */ }
}

export function requireRunning(): E2eStatus {
  const s = read();
  if (!s) {
    console.error(`Headless Chrome (worktree "${NAMESPACE}") is not running. Start it first: ./scripts/e2e.ts start`);
    process.exit(1);
  }
  try { process.kill(s.pid, 0); } catch {
    console.error(`Headless Chrome (worktree "${NAMESPACE}") process is dead. Restart: ./scripts/e2e.ts start`);
    remove();
    process.exit(1);
  }
  return s;
}
