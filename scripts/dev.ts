#!/usr/bin/env -S node --import tsx
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

import { loadConfig } from "shared/config";

import { DevProcess } from "./dev/dev-process.js";

const STATUS_FILE = path.join(process.cwd(), ".dev-status.json");

// Parent-death detection + watchdog. Only armed in foreground mode — for
// status/stop/start subcommands these would (a) keep the short-lived command
// alive forever via setInterval, and (b) for `start`, trip the moment the
// launcher exits (ppid→1 on the detached child) and kill the dev server.
function armProcessGuards() {
  const parentPid = process.ppid;
  setInterval(() => {
    // ppid becomes 1 when reparented to init (normal for detached processes);
    // only treat a *different non-1* ppid as a real parent-death signal.
    if (process.ppid !== parentPid && process.ppid !== 1) {
      try { process.kill(0, "SIGTERM"); } catch {}
      process.exit(1);
    }
  }, 500);

  // Separate process that polls our PID. If we die (even SIGKILL), the
  // watchdog kills the entire process group. Handles the untrappable case.
  spawn("node", ["-e", `
    setInterval(() => {
      try { process.kill(${process.pid}, 0); } catch { process.kill(0, "SIGTERM"); process.exit(); }
    }, 500);
  `], { stdio: "ignore" });
}

// --- Status file ---

interface ProcessStatus {
  status: "starting" | "ready";
  pid: number | null;
}

interface DevStatus {
  status: "starting" | "ready";
  url: string;
  pid: number;
  processes: Record<string, ProcessStatus>;
}

function readStatus(): DevStatus | null {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function writeStatus(s: DevStatus) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(s, null, 2) + "\n");
}

function deleteStatus() {
  try {
    fs.unlinkSync(STATUS_FILE);
  } catch {
    /* already gone */
  }
}

// --- Subcommands ---

const subcommand = process.argv[2];

if (subcommand === "status") {
  cmdStatus();
} else if (subcommand === "stop") {
  cmdStop();
} else if (subcommand === "start") {
  cmdStart();
} else {
  void cmdForeground();
}

// --- status ---

function cmdStatus() {
  const s = readStatus();
  if (!s) {
    console.log("not running");
    process.exit(1);
  }
  const procs = Object.entries(s.processes)
    .map(([name, p]) => `${name}:${p.status}`)
    .join(" ");
  console.log(`${s.status} | ${s.url} | ${procs} | pid:${s.pid}`);
}

// --- stop ---

function cmdStop() {
  const s = readStatus();
  if (!s) {
    console.log("not running");
    return;
  }
  try {
    process.kill(-s.pid, "SIGTERM");
  } catch {
    /* already dead */
  }
  for (const proc of Object.values(s.processes)) {
    if (proc.pid) {
      try {
        process.kill(-proc.pid, "SIGTERM");
      } catch {
        /* already dead */
      }
    }
  }
  deleteStatus();
  console.log("stopped");
}

// --- start (background, wait for ready, return) ---

function cmdStart() {
  const stale = readStatus();
  if (stale) {
    const alive = (() => {
      try {
        process.kill(stale.pid, 0);
        return true;
      } catch {
        return false;
      }
    })();
    if (alive) {
      console.log(`already running | ${stale.url} | pid:${stale.pid}`);
      return;
    }
    deleteStatus();
  }

  const child = spawn("./scripts/dev.ts", [], {
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  const timeout = 30_000;
  const start = Date.now();
  const poll = setInterval(() => {
    const s = readStatus();
    if (s?.status === "ready") {
      clearInterval(poll);
      console.log(`ready | ${s.url} | pid:${s.pid}`);
      process.exit(0);
    }
    if (Date.now() - start > timeout) {
      clearInterval(poll);
      console.error("timeout waiting for dev server to be ready");
      process.exit(1);
    }
  }, 300);
}

// --- foreground (interactive, streams output) ---

async function cmdForeground() {
  armProcessGuards();
  process.title = "dev:main";
  console.log(`dev:main pid=${process.pid}`);
  const config = loadConfig();
  const edgeUrl = `http://localhost:${config.edge.devPort}`;

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      env: { type: "string", short: "e", default: "development" },
      open: { type: "boolean", short: "o", default: false },
      tunnel: { type: "boolean", short: "t", default: false },
    },
    strict: false,
  });

  const envFlag = [`--env=${values.env}`];

  const status: DevStatus = {
    status: "starting",
    url: edgeUrl,
    pid: process.pid,
    processes: {},
  };

  // Kill stale dev server from a previous crashed session
  const stale = readStatus();
  if (stale && stale.pid !== process.pid) {
    try {
      process.kill(stale.pid, 0);
      process.kill(-stale.pid, "SIGTERM");
    } catch {
      /* already dead */
    }
    deleteStatus();
  }

  const all: DevProcess[] = [];

  // Tunnel script updates env config, so we must wait for it before starting servers
  if (values.tunnel) {
    const tunnel = new DevProcess("Tunnel", "./packages/backend/scripts/tunnel.ts", [], { color: "\x1b[36m" });
    all.push(tunnel);
    await tunnel.waitForStdout({ pattern: "tunnel", timeout: 1000 * 30 });
  }

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    deleteStatus();
    console.log("\x1b[33mShutting down...\x1b[0m");
    for (const p of all) p.kill();
    try { process.kill(0, "SIGTERM"); } catch {}
    process.exit(1);
  };

  const backend = new DevProcess("Backend", "./scripts/dev.ts", envFlag, { color: "\x1b[34m", cwd: "packages/backend", onCrash: shutdown });
  const frontend = new DevProcess("Frontend", "./scripts/dev.ts", envFlag, { color: "\x1b[32m", cwd: "packages/frontend", onCrash: shutdown });
  const edge = new DevProcess("Edge", "./scripts/dev.ts", [], { color: "\x1b[35m", cwd: "packages/edge", onCrash: shutdown });
  const types = new DevProcess("Types", "./scripts/dev-types.ts", [], { color: "\x1b[33m", cwd: "packages/backend" });

  const critical = [backend, frontend, edge];
  all.push(backend, frontend, edge, types);

  // Track process status
  for (const p of all) {
    status.processes[p.name.toLowerCase()] = { status: "starting", pid: p.pid ?? null };
  }
  writeStatus(status);

  for (const sig of ["SIGINT", "SIGTERM", "SIGTSTP"] as const) {
    process.on(sig, () => shutdown());
  }

  try {
    await Promise.all([
      backend.waitForStdout({ pattern: "Backend running on", timeout: 1000 * 5 }),
      frontend.waitForStdout({ pattern: "Local:", timeout: 1000 * 5 }),
      edge.waitForStdout({ pattern: "Edge proxy running on", timeout: 1000 * 5 }),
    ]);
  } catch (error) {
    console.error(`\x1b[31m${error instanceof Error ? error.message : error}\x1b[0m`);
    shutdown();
  }

  // Update status to ready
  for (const p of all) {
    status.processes[p.name.toLowerCase()] = { status: "ready", pid: p.pid ?? null };
  }
  status.status = "ready";
  writeStatus(status);

  console.log(`\n\x1b[32m✓ Dev server ready at ${edgeUrl}\x1b[0m\n`);

  if (values.open) {
    spawn("./scripts/open-chrome.sh", [`http://localhost:${config.edge.devPort}`], { stdio: "inherit" });
  }
}

void 0; // module marker
