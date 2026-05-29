import { expect, test } from "@playwright/test";

test("poker scene boots with initial progress", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hud")).toHaveText("0 / 16 sorted");
  await expect(page.locator("#help")).toContainText("WASD");
  await expect(page.locator("#help")).toContainText("column");
});

test("test API supports multi-chip hand, wheel-style rotation, and top-chip placement", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(() => {
    type TestApi = {
      triggerPickChip: (chipIndex: number) => boolean;
      triggerPlaceColumn: (columnIndex: number) => boolean;
      triggerRotateUp: () => boolean;
      triggerRotateDown: () => boolean;
      getHeldChipIds: () => string[];
      getHeldCount: () => number;
      getHeldTopChipId: () => string | null;
      firstUnplacedChipByColor: (color: "white" | "black" | "red" | "green") => number;
      getProgress: () => string;
      getChipPositionY: (chipIndex: number) => number | null;
      getStackCenterYForCount: (stackedCount: number) => number;
    };
    const api = (window as Window & { __zenventoryTestApi?: TestApi }).__zenventoryTestApi;
    if (!api) {
      throw new Error("Missing __zenventoryTestApi");
    }

    const whiteChip = api.firstUnplacedChipByColor("white");
    const blackChip = api.firstUnplacedChipByColor("black");
    const redChip = api.firstUnplacedChipByColor("red");
    const greenChip = api.firstUnplacedChipByColor("green");

    const firstPick = api.triggerPickChip(whiteChip);
    const secondPick = api.triggerPickChip(blackChip);
    const thirdPick = api.triggerPickChip(redChip);
    const fourthPick = api.triggerPickChip(greenChip);

    const fifthChip = api.firstUnplacedChipByColor("white");
    const blockedFifthPick = api.triggerPickChip(fifthChip);

    const heldBeforeRotate = api.getHeldChipIds();
    const rotateUp = api.triggerRotateUp();
    const heldAfterRotateUp = api.getHeldChipIds();
    const rotateDown = api.triggerRotateDown();
    const heldAfterRotateDown = api.getHeldChipIds();
    const topChipAfterRotation = api.getHeldTopChipId();

    const wrongPlacement = api.triggerPlaceColumn(2);
    const correctPlacement = api.triggerPlaceColumn(3);
    const placedY = api.getChipPositionY(greenChip);
    const expectedFirstStackY = api.getStackCenterYForCount(1);
    const heldCountAfterPlacement = api.getHeldCount();

    const pickAfterPlacement = api.triggerPickChip(fifthChip);
    const heldCountAfterRepick = api.getHeldCount();

    return {
      firstPick,
      secondPick,
      thirdPick,
      fourthPick,
      blockedFifthPick,
      heldBeforeRotate,
      rotateUp,
      heldAfterRotateUp,
      rotateDown,
      heldAfterRotateDown,
      topChipAfterRotation,
      wrongPlacement,
      correctPlacement,
      progress: api.getProgress(),
      placedY,
      expectedFirstStackY,
      heldCountAfterPlacement,
      pickAfterPlacement,
      heldCountAfterRepick
    };
  });

  expect(result.firstPick).toBe(true);
  expect(result.secondPick).toBe(true);
  expect(result.thirdPick).toBe(true);
  expect(result.fourthPick).toBe(true);
  expect(result.blockedFifthPick).toBe(false);
  expect(result.heldBeforeRotate).toHaveLength(4);
  expect(result.rotateUp).toBe(true);
  expect(result.heldAfterRotateUp).toEqual([
    result.heldBeforeRotate[3],
    result.heldBeforeRotate[0],
    result.heldBeforeRotate[1],
    result.heldBeforeRotate[2]
  ]);
  expect(result.rotateDown).toBe(true);
  expect(result.heldAfterRotateDown).toEqual(result.heldBeforeRotate);
  expect(result.topChipAfterRotation).toBe(result.heldBeforeRotate[3]);
  expect(result.wrongPlacement).toBe(false);
  expect(result.correctPlacement).toBe(true);
  expect(result.progress).toBe("1 / 16 sorted");
  expect(result.placedY).toBeCloseTo(result.expectedFirstStackY, 6);
  expect(result.heldCountAfterPlacement).toBe(3);
  expect(result.pickAfterPlacement).toBe(true);
  expect(result.heldCountAfterRepick).toBe(4);
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

test("held chip stays in front of wall surface when facing wall up close", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(() => {
    type Bounds = {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    };
    type Position = {
      x: number;
      y: number;
      z: number;
    };
    type TestApi = {
      firstUnplacedChipByColor: (color: "white" | "black" | "red" | "green") => number;
      triggerPickChip: (chipIndex: number) => boolean;
      setCameraPositionXZ: (x: number, z: number) => { x: number; z: number };
      setCameraLookDirectionXZ: (x: number, z: number) => void;
      stepSimulation: (delta: number, steps: number) => void;
      getHeldChipPosition: () => Position | null;
      getWallInnerBounds: () => Bounds;
      getHeldChipForwardRadius: () => number;
    };

    const api = (window as Window & { __zenventoryTestApi?: TestApi }).__zenventoryTestApi;
    if (!api) {
      throw new Error("Missing __zenventoryTestApi");
    }

    const chipIndex = api.firstUnplacedChipByColor("white");
    const picked = api.triggerPickChip(chipIndex);
    if (!picked) {
      throw new Error("Failed to pick chip for clipping test");
    }

    const walls = api.getWallInnerBounds();
    api.setCameraPositionXZ(walls.maxX - 0.3, 0);
    api.setCameraLookDirectionXZ(1, 0);
    api.stepSimulation(1 / 60, 120);

    const held = api.getHeldChipPosition();
    if (!held) {
      throw new Error("Missing held chip position");
    }

    return {
      held,
      walls,
      radius: api.getHeldChipForwardRadius()
    };
  });

  expect(result.held.x + result.radius).toBeLessThanOrEqual(result.walls.maxX - 0.01);
});
