import { expect, test } from "@playwright/test";

test("hello world scene boots with initial progress", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hud")).toHaveText("0 / 1 sorted");
  await expect(page.locator("#help")).toContainText("WASD");
});

test("test API can complete one sorting action", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    const api = (window as Window & { __zenventoryTestApi?: { triggerPick: () => void; triggerPlace: () => void } }).__zenventoryTestApi;
    if (!api) {
      throw new Error("Missing __zenventoryTestApi");
    }

    api.triggerPick();
    api.triggerPlace();
  });

  await expect(page.locator("#hud")).toHaveText("1 / 1 sorted");
});
