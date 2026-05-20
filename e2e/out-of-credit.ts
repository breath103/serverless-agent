import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

import { harness } from "./_helpers.js";

const TMP_DIR = resolve(process.cwd(), ".tmp");
const FRAME_PREFIX = "issue-17-out-of-credit-frame-";
const VIDEO_PATH = resolve(TMP_DIR, "issue-17-out-of-credit.mp4");

export default harness(async ({ step, stepOrExit, log, page, request }) => {
  mkdirSync(TMP_DIR, { recursive: true });
  readdirSync(TMP_DIR).filter((f) => f.startsWith(FRAME_PREFIX)).forEach((f) => unlinkSync(resolve(TMP_DIR, f)));

  const login = await request.post("/api/auth/dev-login");
  stepOrExit("POST /api/auth/dev-login → 200", login.ok(), `status ${login.status()}`);

  const drain = await request.post("/api/dev/set-credits", { data: { credits: 0 } });
  stepOrExit("POST /api/dev/set-credits {credits:0} → 200", drain.ok(), `status ${drain.status()}`);

  try {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.locator("a", { hasText: "CHAT" }).first().click();
    await page.waitForSelector("textarea", { timeout: 10000 });
    log(`landed on ${page.url()}`);
    step("composer visible at credits=0", true);

    await page.screenshot({ path: resolve(TMP_DIR, `${FRAME_PREFIX}1.png`) });

    const textarea = page.locator("textarea").first();
    await textarea.fill("hi");
    await page.screenshot({ path: resolve(TMP_DIR, `${FRAME_PREFIX}2.png`) });

    await textarea.press("Enter");
    await page.screenshot({ path: resolve(TMP_DIR, `${FRAME_PREFIX}3.png`) });

    await page.waitForSelector("text=You ran out of credit", { timeout: 5000 });
    step("out-of-credit banner appeared", true);
    await page.screenshot({ path: resolve(TMP_DIR, `${FRAME_PREFIX}4.png`) });

    // Hold the final state for a few frames so it's the dominant image in the video
    for (let i = 5; i <= 8; i++) {
      await page.screenshot({ path: resolve(TMP_DIR, `${FRAME_PREFIX}${i}.png`) });
    }

    const second = await request.post("/api/chat", { data: { message: "should still 402" } });
    step(`POST /api/chat returns 402 (got ${second.status()})`, second.status() === 402);

    const ffmpeg = spawnSync("ffmpeg", [
      "-y",
      "-framerate", "1.5",
      "-i", resolve(TMP_DIR, `${FRAME_PREFIX}%d.png`),
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-movflags", "faststart",
      "-pix_fmt", "yuv420p",
      VIDEO_PATH,
    ], { stdio: "inherit" });
    step(`ffmpeg stitched ${VIDEO_PATH}`, ffmpeg.status === 0);
  } finally {
    await request.post("/api/dev/set-credits", { data: { credits: 100 } });
  }
});
