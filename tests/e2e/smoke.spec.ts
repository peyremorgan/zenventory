import { expect, test } from "@playwright/test";

test("poker scene boots with initial progress", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hud")).toHaveText("0 / 16 sorted");
  await expect(page.locator("#help")).toContainText("WASD");
  await expect(page.locator("#help")).toContainText("column");
});

test("test API supports multi-chip hand, wheel-style rotation, and top-chip placement", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    return Boolean((window as Window & { __zenventoryTestApi?: unknown }).__zenventoryTestApi);
  });

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
      isUsingExternalAssets: () => boolean;
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
      heldCountAfterRepick,
      usingExternalAssets: api.isUsingExternalAssets()
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
  expect(result.usingExternalAssets).toBe(true);
  await expect(page.locator("#hud")).toHaveText("1 / 16 sorted");
});

test("test API clamps player movement to outer room walls", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    return Boolean((window as Window & { __zenventoryTestApi?: unknown }).__zenventoryTestApi);
  });

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
  await page.waitForFunction(() => {
    return Boolean((window as Window & { __zenventoryTestApi?: unknown }).__zenventoryTestApi);
  });

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

test("table materials use distinct MTL-driven colors", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    return Boolean((window as Window & { __zenventoryTestApi?: unknown }).__zenventoryTestApi);
  });

  const result = await page.evaluate(() => {
    type MaterialSample = { r: number; g: number; b: number };
    type TestApi = {
      isUsingExternalAssets: () => boolean;
      getTableMaterialSamples: () => Record<string, MaterialSample>;
    };

    const api = (window as Window & { __zenventoryTestApi?: TestApi }).__zenventoryTestApi;
    if (!api) {
      throw new Error("Missing __zenventoryTestApi");
    }

    const samples = api.getTableMaterialSamples();
    return {
      usingExternalAssets: api.isUsingExternalAssets(),
      cloth: samples.cloth,
      cushion: samples.cushion,
      wood: samples.wood
    };
  });

  expect(result.usingExternalAssets).toBe(true);
  expect(result.cloth).toBeDefined();
  expect(result.cushion).toBeDefined();
  expect(result.wood).toBeDefined();

  if (!result.cloth || !result.cushion || !result.wood) {
    return;
  }

  expect(result.cloth.g).toBeGreaterThan(result.cloth.r);
  expect(result.cloth.g).toBeGreaterThan(result.cloth.b);

  expect(result.cushion.r).toBeGreaterThan(result.cushion.g);
  expect(result.cushion.g).toBeGreaterThan(result.cushion.b);

  expect(result.wood.r).toBeGreaterThan(result.wood.g);
  expect(result.wood.g).toBeGreaterThan(result.wood.b);

  expect(result.cloth.g).toBeGreaterThan(result.wood.g);
  expect(result.cushion.r).toBeGreaterThan(result.wood.r);
});

test("thrown chip uses rigid-body physics and can be picked after settling", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => {
    return Boolean((window as Window & { __zenventoryTestApi?: unknown }).__zenventoryTestApi);
  });

  const result = await page.evaluate(() => {
    type Position = { x: number; y: number; z: number };
    type TestApi = {
      firstUnplacedChipByColor: (color: "white" | "black" | "red" | "green") => number;
      triggerPickChip: (chipIndex: number) => boolean;
      triggerThrowTopChip: () => boolean;
      isChipThrown: (chipIndex: number) => boolean;
      getChipPosition: (chipIndex: number) => Position | null;
      getChipLinearSpeed: (chipIndex: number) => number;
      getChipAngularSpeed: (chipIndex: number) => number;
      stepSimulation: (delta: number, steps: number) => void;
      getHeldCount: () => number;
    };

    const api = (window as Window & { __zenventoryTestApi?: TestApi }).__zenventoryTestApi;
    if (!api) {
      throw new Error("Missing __zenventoryTestApi");
    }

    const chipIndex = api.firstUnplacedChipByColor("white");
    const picked = api.triggerPickChip(chipIndex);
    const startPosition = api.getChipPosition(chipIndex);
    const thrown = api.triggerThrowTopChip();
    const isThrownAfterThrow = api.isChipThrown(chipIndex);

    api.stepSimulation(1 / 120, 90);
    const midPosition = api.getChipPosition(chipIndex);
    const linearSpeedAfterThrow = api.getChipLinearSpeed(chipIndex);
    const angularSpeedAfterThrow = api.getChipAngularSpeed(chipIndex);

    api.stepSimulation(1 / 120, 900);
    const isThrownAfterSettle = api.isChipThrown(chipIndex);
    const repicked = api.triggerPickChip(chipIndex);
    const heldCountAfterRepick = api.getHeldCount();

    return {
      picked,
      thrown,
      isThrownAfterThrow,
      startPosition,
      midPosition,
      linearSpeedAfterThrow,
      angularSpeedAfterThrow,
      isThrownAfterSettle,
      repicked,
      heldCountAfterRepick
    };
  });

  expect(result.picked).toBe(true);
  expect(result.thrown).toBe(true);
  expect(result.isThrownAfterThrow).toBe(true);
  expect(result.startPosition).not.toBeNull();
  expect(result.midPosition).not.toBeNull();
  if (!result.startPosition || !result.midPosition) {
    throw new Error("Missing chip positions for throw test assertions");
  }

  const dx = result.midPosition.x - result.startPosition.x;
  const dy = result.midPosition.y - result.startPosition.y;
  const dz = result.midPosition.z - result.startPosition.z;
  const distance = Math.hypot(dx, dy, dz);

  expect(distance).toBeGreaterThan(0.2);
  expect(result.linearSpeedAfterThrow).toBeGreaterThan(0.1);
  expect(result.angularSpeedAfterThrow).toBeGreaterThan(0.1);
  expect(result.isThrownAfterSettle).toBe(false);
  expect(result.repicked).toBe(true);
  expect(result.heldCountAfterRepick).toBe(1);
});
