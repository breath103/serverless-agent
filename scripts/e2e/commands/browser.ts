import path from "node:path";

import { chromium } from "playwright";
import { z } from "zod";

import { Command } from "../command.js";
import { TMP_DIR, edgeUrl } from "../constants.js";
import { requireRunning } from "../status.js";

async function withPage<T>(fn: (page: import("playwright").Page) => Promise<T>): Promise<T> {
  const e2e = requireRunning();
  const browser = await chromium.connectOverCDP(e2e.cdpEndpoint);
  try {
    const contexts = browser.contexts();
    const context = contexts[0] ?? await browser.newContext();
    const pages = context.pages();
    const page = pages[0] ?? await context.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
}

export const navigate = new Command("Navigate to path (relative to edge proxy)",
  z.tuple([z.string().describe("path")]),
  (target) => withPage(async (page) => {
    const url = target.startsWith("http") ? target : `${edgeUrl}${target}`;
    await page.goto(url, { waitUntil: "networkidle" });
    console.log(`navigated to ${page.url()}`);
  }),
);

export const screenshot = new Command("Take screenshot",
  z.tuple([z.string().describe("out-path").optional()]),
  (outPath) => withPage(async (page) => {
    const out = outPath ?? path.join(TMP_DIR, `screenshot-${Date.now()}.png`);
    // animations:"disabled" pauses framer-motion / CSS / Web Animations so
    // fullPage captures don't race infinite loops. timeout: 5000 fails fast
    // instead of the 30s default — when a screenshot does go wrong, you
    // find out in 5s.
    await page.screenshot({ path: out, fullPage: true, animations: "disabled", timeout: 5000 });
    console.log(out);
  }),
);

export const runJs = new Command("Execute JS in page, print result",
  z.tuple([z.string().describe("expression")]),
  (expr) => withPage(async (page) => {
    const result = await page.evaluate(expr);
    console.log(JSON.stringify(result, null, 2));
  }),
);

export const click = new Command("Click element",
  z.tuple([z.string().describe("selector")]),
  (selector) => withPage(async (page) => {
    await page.click(selector);
    console.log(`clicked ${selector}`);
  }),
);

export const type = new Command("Type into element",
  z.tuple([z.string().describe("selector"), z.string().describe("text")]),
  (selector, text) => withPage(async (page) => {
    await page.fill(selector, text);
    console.log(`typed into ${selector}`);
  }),
);

export const wait = new Command("Wait for element to appear",
  z.tuple([z.string().describe("selector")]),
  (selector) => withPage(async (page) => {
    await page.waitForSelector(selector, { timeout: 30_000 });
    console.log(`found ${selector}`);
  }),
);

export const setViewport = new Command("Set viewport size",
  z.tuple([z.coerce.number().describe("width"), z.coerce.number().describe("height")]),
  (w, h) => withPage(async (page) => {
    await page.setViewportSize({ width: w, height: h });
    console.log(`viewport set to ${w}x${h}`);
  }),
);

export const login = new Command("Authenticate as dev user", z.tuple([]),
  () => withPage(async (page) => {
    await page.goto(edgeUrl);
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/auth/dev-login", { method: "POST" });
      return { status: res.status, ok: res.ok };
    });
    if (!result.ok) {
      console.error(`Login failed with status ${result.status}`);
      process.exit(1);
    }
    console.log("logged in as dev user");
  }),
);

export const pageText = new Command("Print page text content", z.tuple([]),
  () => withPage(async (page) => {
    const text = await page.evaluate(() => document.body.innerText);
    console.log(text);
  }),
);
