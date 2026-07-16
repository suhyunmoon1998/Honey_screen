import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  execSync("pnpm db:reset", {
    cwd: process.cwd(),
    stdio: "ignore",
    env: process.env,
  });
});

test("runner health survives setup, body, and teardown with default artifacts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await page.waitForLoadState("networkidle");
});
