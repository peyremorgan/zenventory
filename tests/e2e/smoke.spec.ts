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

test("test API clamps player movement to outer room walls", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(() => {
    type Bounds = {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    };
    type KeyState = {
      forward: boolean;
      backward: boolean;
      left: boolean;
      right: boolean;
    };
    type TestApi = {
      setCameraPositionXZ: (x: number, z: number) => { x: number; z: number };
      getRoomBounds: () => Bounds;
      simulateMoveStep: (input: Partial<KeyState>, delta: number) => { x: number; z: number };
    };

    const api = (window as Window & { __zenventoryTestApi?: TestApi }).__zenventoryTestApi;
    if (!api) {
      throw new Error("Missing __zenventoryTestApi");
    }

    const bounds = api.getRoomBounds();

    api.setCameraPositionXZ(bounds.maxX - 0.05, 0);
    const rightWall = api.simulateMoveStep({ right: true }, 3);

    api.setCameraPositionXZ(0, bounds.minZ + 0.05);
    const backWall = api.simulateMoveStep({ forward: true }, 3);

    return {
      bounds,
      rightWall,
      backWall
    };
  });

  expect(result.rightWall.x).toBe(result.bounds.maxX);
  expect(result.backWall.z).toBe(result.bounds.minZ);
});
