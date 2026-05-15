import { type Scenario } from "./_helpers.js";

const scenario: Scenario = async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/\/login(\?|$)/);
  await page.waitForSelector("text=Sign in");
};

export default scenario;
