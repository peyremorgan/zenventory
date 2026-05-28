import { expect, test } from "@playwright/test";

test("poker scene boots with initial progress", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hud")).toHaveText("0 / 16 sorted");
  await expect(page.locator("#help")).toContainText("WASD");
  await expect(page.locator("#help")).toContainText("column");
});

test("test API enforces one-chip hold and correct-column placement", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(() => {
    type TestApi = {
      triggerPickChip: (chipIndex: number) => boolean;
      triggerPlaceColumn: (columnIndex: number) => boolean;
      firstUnplacedChipByColor: (color: "white" | "black" | "red" | "green") => number;
      getProgress: () => string;
      getChipPositionY: (chipIndex: number) => number | null;
      getStackCenterYForCount: (stackedCount: number) => number;
    };
    const api = (window as Window & { __zenventoryTestApi?: TestApi }).__zenventoryTestApi;
    if (!api) {
      throw new Error("Missing __zenventoryTestApi");
    }

    const redChip = api.firstUnplacedChipByColor("red");
    const whiteChip = api.firstUnplacedChipByColor("white");

    const firstPick = api.triggerPickChip(redChip);
    const blockedSecondPick = api.triggerPickChip(whiteChip);
    const wrongPlacement = api.triggerPlaceColumn(0);
    const correctPlacement = api.triggerPlaceColumn(2);
    const placedY = api.getChipPositionY(redChip);
    const expectedFirstStackY = api.getStackCenterYForCount(1);

    return {
      firstPick,
      blockedSecondPick,
      wrongPlacement,
      correctPlacement,
      progress: api.getProgress(),
      placedY,
      expectedFirstStackY
    };
  });

  expect(result.firstPick).toBe(true);
  expect(result.blockedSecondPick).toBe(false);
  expect(result.wrongPlacement).toBe(false);
  expect(result.correctPlacement).toBe(true);
  expect(result.progress).toBe("1 / 16 sorted");
  expect(result.placedY).toBeCloseTo(result.expectedFirstStackY, 6);
  await expect(page.locator("#hud")).toHaveText("1 / 16 sorted");
});
