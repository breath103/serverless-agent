#!/usr/bin/env -S node --import tsx
process.title = "dev:backend:watcher";

import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { merge, Observable } from "rxjs";
import { debounceTime, startWith } from "rxjs/operators";

import { loadEnv } from "./lib/env.js";

const { values } = parseArgs({
  options: { env: { type: "string", short: "e", default: "development" } },
  strict: false,
});
loadEnv(values.env);

const ROOT = path.join(import.meta.dirname, "..");
const srcPath = path.join(ROOT, "src");

const watch$ = (p: string, opts?: { recursive?: boolean }) =>
  new Observable<void>((sub) => {
    watch(p, opts, () => sub.next());
  });

let ac: AbortController | null = null;

const startServer = () => {
  ac = new AbortController();
  const child = spawn("tsx", ["scripts/server.ts"], {
    cwd: ROOT,
    stdio: "inherit",
    signal: ac.signal,
  });
  child.on("error", (err) => {
    if ((err as NodeJS.ErrnoException).code === "ABORT_ERR") return;
    console.error(err);
  });
};

merge(watch$(srcPath, { recursive: true }))
  .pipe(debounceTime(100), startWith(null))
  .subscribe(() => {
    ac?.abort();
    startServer();
  });

process.on("SIGINT", () => {
  ac?.abort();
  process.exit(0);
});
process.on("SIGTERM", () => {
  ac?.abort();
  process.exit(0);
});
