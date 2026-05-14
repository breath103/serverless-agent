import { spawn } from "node:child_process";
import path from "node:path";

import { chromium } from "playwright";
import { z } from "zod";

import { Command } from "../command.js";
import { TMP_DIR } from "../constants.js";
import * as status from "../status.js";

async function waitForCdp(port: number, timeoutMs = 10_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const data = await res.json() as { webSocketDebuggerUrl: string };
      return data.webSocketDebuggerUrl;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`Timed out waiting for CDP on port ${port}`);
}

async function portInUse(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) });
    return res.ok;
  } catch {
    return false;
  }
}

export const start = new Command("Start headless Chrome (stores CDP endpoint)", z.tuple([]), async () => {
  const existing = status.read();
  if (existing) {
    try {
      process.kill(existing.pid, 0);
      console.log(`already running | pid:${existing.pid} | ${existing.cdpEndpoint}`);
      return;
    } catch {
      status.remove();
    }
  }

  // Fail loudly if something else is already on the CDP port — otherwise
  // `waitForCdp` below silently connects to the squatter, and every
  // subsequent command talks to someone else's browser. Symptom:
  // page.screenshot() hangs because the other project's Chrome refuses
  // to capture (or is long dead / wedged).
  if (await portInUse(status.CDP_PORT)) {
    console.error(`CDP port ${status.CDP_PORT} is already in use by another process.`);
    console.error(`Likely a stale headless Chrome from another worktree. Find and kill it:`);
    console.error(`  lsof -i :${status.CDP_PORT} -P`);
    process.exit(1);
  }

  const chrome = spawn(chromium.executablePath(), [
    // --headless=new (the default since Chrome 132) is a real browser, can
    // raster frames, and screenshots work. The legacy --headless=old +
    // --disable-gpu combo silently hangs Page.captureScreenshot because
    // there's no rasterizer wired up. Don't downgrade either flag.
    "--headless=new",
    `--remote-debugging-port=${status.CDP_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--window-size=1280,800",
    `--user-data-dir=${path.join(TMP_DIR, `e2e-chrome-profile-${status.NAMESPACE}`)}`,
  ], { stdio: "ignore", detached: true });
  chrome.unref();

  if (!chrome.pid) {
    console.error("Failed to start Chrome");
    process.exit(1);
  }

  const endpoint = await waitForCdp(status.CDP_PORT);
  status.write({ cdpEndpoint: endpoint, pid: chrome.pid });
  console.log(`started | worktree:${status.NAMESPACE} | pid:${chrome.pid} | ${endpoint}`);
});

export const stop = new Command("Stop headless Chrome", z.tuple([]), async () => {
  const s = status.read();
  if (!s) {
    console.log("not running");
    return;
  }
  try { process.kill(s.pid, "SIGTERM"); } catch { /* already dead */ }
  status.remove();
  console.log("stopped");
});
