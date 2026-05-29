import { Clock, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import { createHud } from "./hud";
import { applyMovementStep, createPlayer, type KeyState } from "./player";
import { ROOM_BOUNDS, clampPositionToRoom, toWallInnerBounds } from "./roomBounds";
import { canPlaceChip, canPickChip, placeChip, pickChip, type Chip } from "./sorting";
import { setupScene } from "./scene";
import { stackChipCenterY } from "./stacking";
import { damp, getSafeHeldForwardDistance, HELD_CHIP_FORWARD_RADIUS } from "./wallProximity";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing #game canvas.");
}

const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new Scene();
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 1.8);

const room = setupScene(scene);
const player = createPlayer(camera, canvas);
const hud = createHud(room.chipMeshes.length);

const raycaster = new Raycaster();
const screenCenter = new Vector2(0, 0);
const clock = new Clock();

const chips: Chip[] = room.chipSpawnColors.map((color, index) => ({
  id: `chip-${color}-${index}`,
  color,
  isPlaced: false,
  isHeld: false,
  placedColumnIndex: null
}));

let sortedCount = 0;
let heldChipIndices: number[] = [];
let heldForwardDistance = -room.holdOffset.z;
hud.update(sortedCount);

const worldForward = new Vector3();

function getHeldChips(): Chip[] {
  return heldChipIndices
    .map((chipIndex) => chips[chipIndex])
    .filter((chip): chip is Chip => chip !== undefined);
}

function rotateHeldChipsUp(): boolean {
  if (heldChipIndices.length < 2) {
    return false;
  }

  const topChipIndex = heldChipIndices[heldChipIndices.length - 1];
  if (topChipIndex === undefined) {
    return false;
  }

  heldChipIndices = [topChipIndex, ...heldChipIndices.slice(0, -1)];
  return true;
}

function rotateHeldChipsDown(): boolean {
  if (heldChipIndices.length < 2) {
    return false;
  }

  const [bottomChipIndex, ...remainingChipIndices] = heldChipIndices;
  if (bottomChipIndex === undefined) {
    return false;
  }

  heldChipIndices = [...remainingChipIndices, bottomChipIndex];
  return true;
}

function placeHeldChipIntoColumn(chipIndex: number, columnIndex: number): boolean {
  const chip = chips[chipIndex];
  const column = room.columns[columnIndex];
  const columnMesh = room.caseColumns[columnIndex];
  if (!chip || !column || !columnMesh) {
    return false;
  }

  const wasPlaced = chip.isPlaced;
  const heldChips = getHeldChips();
  const next = placeChip(chip, column, heldChips);
  if (!canPlaceChip(chip, column, heldChips) || next === chip) {
    return false;
  }

  const topChipIndex = heldChipIndices[heldChipIndices.length - 1];
  if (topChipIndex !== chipIndex) {
    return false;
  }

  chips[chipIndex] = next;
  const stackedCount = chips.filter(
    (placedChip) => placedChip.isPlaced && placedChip.placedColumnIndex === columnIndex
  ).length;
  const placedMesh = room.chipMeshes[chipIndex];
  placedMesh.rotation.set(0, 0, 0);
  placedMesh.position.set(
    columnMesh.position.x,
    stackChipCenterY(room.columnStackBaseY, room.chipHeight, stackedCount),
    columnMesh.position.z
  );
  heldChipIndices = heldChipIndices.slice(0, -1);

  if (!wasPlaced) {
    sortedCount += 1;
    hud.update(sortedCount);
  }

  return true;
}

function updateHeldObjectPosition(delta: number): void {
  if (heldChipIndices.length === 0) {
    heldForwardDistance = -room.holdOffset.z;
    return;
  }

  camera.getWorldDirection(worldForward);
  const targetForwardDistance = getSafeHeldForwardDistance(
    camera.position,
    worldForward,
    -room.holdOffset.z
  );

  const safeDelta = Math.max(0, delta);
  heldForwardDistance = damp(heldForwardDistance, targetForwardDistance, 18, safeDelta);

  heldChipIndices.forEach((chipIndex, stackIndex) => {
    const heldMesh = room.chipMeshes[chipIndex];
    const target = room.holdOffset.clone();
    target.y += stackIndex * room.chipHeight;
    target.z = -heldForwardDistance;
    target.applyQuaternion(camera.quaternion);
    target.add(camera.position);
    heldMesh.position.copy(target);
    heldMesh.quaternion.copy(camera.quaternion);
  });
}

function tryInteract(): void {
  raycaster.setFromCamera(screenCenter, camera);

  const columnHits = raycaster.intersectObjects(room.caseColumns, false);
  const firstColumn = columnHits[0]?.object;
  if (firstColumn && heldChipIndices.length > 0) {
    const topChipIndex = heldChipIndices[heldChipIndices.length - 1];
    if (topChipIndex === undefined) {
      return;
    }

    const columnIndex = firstColumn.userData.columnIndex;
    if (typeof columnIndex !== "number") {
      return;
    }

    const column = room.columns[columnIndex];
    const heldChip = chips[topChipIndex];
    const heldChips = getHeldChips();
    if (!canPlaceChip(heldChip, column, heldChips)) {
      return;
    }

    placeHeldChipIntoColumn(topChipIndex, columnIndex);
    return;
  }

  const intersections = raycaster.intersectObjects(room.chipMeshes, false);
  const firstChip = intersections[0]?.object;
  if (!firstChip) {
    return;
  }

  const chipIndex = room.chipMeshes.findIndex((mesh) => mesh === firstChip);
  if (chipIndex < 0) {
    return;
  }

  const current = chips[chipIndex];
  const heldChips = getHeldChips();
  const next = pickChip(current, heldChips);
  if (canPickChip(current, heldChips) && next !== current) {
    chips[chipIndex] = next;
    heldChipIndices = [...heldChipIndices, chipIndex];
  }
}

canvas.addEventListener("mousedown", () => {
  tryInteract();
});

canvas.addEventListener(
  "wheel",
  (event) => {
    if (heldChipIndices.length < 2) {
      return;
    }

    event.preventDefault();
    if (event.deltaY < 0) {
      rotateHeldChipsUp();
    } else if (event.deltaY > 0) {
      rotateHeldChipsDown();
    }
  },
  { passive: false }
);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (typeof window !== "undefined") {
  const testApi = {
    getProgress: (): string => document.getElementById("hud")?.textContent ?? "",
    triggerPickChip: (chipIndex: number): boolean => {
      const chip = chips[chipIndex];
      if (!chip) {
        return false;
      }
      const heldChips = getHeldChips();
      if (!canPickChip(chip, heldChips)) {
        return false;
      }
      chips[chipIndex] = pickChip(chip, heldChips);
      heldChipIndices = [...heldChipIndices, chipIndex];
      return true;
    },
    triggerPlaceColumn: (columnIndex: number): boolean => {
      if (heldChipIndices.length === 0) {
        return false;
      }

      const topChipIndex = heldChipIndices[heldChipIndices.length - 1];
      if (topChipIndex === undefined) {
        return false;
      }

      const heldChip = chips[topChipIndex];
      const column = room.columns[columnIndex];
      if (!column || !canPlaceChip(heldChip, column, getHeldChips())) {
        return false;
      }

      return placeHeldChipIntoColumn(topChipIndex, columnIndex);
    },
    triggerRotateUp: (): boolean => rotateHeldChipsUp(),
    triggerRotateDown: (): boolean => rotateHeldChipsDown(),
    getHeldChipIds: (): string[] =>
      heldChipIndices
        .map((chipIndex) => chips[chipIndex]?.id)
        .filter((chipId): chipId is string => chipId !== undefined),
    getHeldCount: (): number => heldChipIndices.length,
    getHeldTopChipId: (): string | null => {
      const topChipIndex = heldChipIndices[heldChipIndices.length - 1];
      if (topChipIndex === undefined) {
        return null;
      }
      return chips[topChipIndex]?.id ?? null;
    },
    firstUnplacedChipByColor: (color: Chip["color"]): number => {
      for (let index = 0; index < chips.length; index += 1) {
        const chip = chips[index];
        if (chip.color === color && !chip.isPlaced && !chip.isHeld) {
          return index;
        }
      }
      return -1;
    },
    getChipPositionY: (chipIndex: number): number | null => {
      const chipMesh = room.chipMeshes[chipIndex];
      return chipMesh ? chipMesh.position.y : null;
    },
    getStackCenterYForCount: (stackedCount: number): number =>
      stackChipCenterY(room.columnStackBaseY, room.chipHeight, stackedCount),
    getCameraPositionXZ: (): { x: number; z: number } => ({
      x: camera.position.x,
      z: camera.position.z
    }),
    setCameraPositionXZ: (x: number, z: number): { x: number; z: number } => {
      camera.position.x = x;
      camera.position.z = z;
      clampPositionToRoom(camera.position);
      return {
        x: camera.position.x,
        z: camera.position.z
      };
    },
    simulateMoveStep: (input: Partial<KeyState>, delta: number): { x: number; z: number } => {
      const keys: KeyState = {
        forward: Boolean(input.forward),
        backward: Boolean(input.backward),
        left: Boolean(input.left),
        right: Boolean(input.right)
      };

      applyMovementStep(camera, camera.position, keys, delta);

      return {
        x: camera.position.x,
        z: camera.position.z
      };
    },
    getRoomBounds: (): typeof ROOM_BOUNDS => ({ ...ROOM_BOUNDS }),
    getWallInnerBounds: (): typeof ROOM_BOUNDS => toWallInnerBounds(),
    getHeldChipPosition: (): { x: number; y: number; z: number } | null => {
      const topChipIndex = heldChipIndices[heldChipIndices.length - 1];
      if (topChipIndex === undefined) {
        return null;
      }

      const heldMesh = room.chipMeshes[topChipIndex];
      return {
        x: heldMesh.position.x,
        y: heldMesh.position.y,
        z: heldMesh.position.z
      };
    },
    setCameraLookDirectionXZ: (x: number, z: number): void => {
      const length = Math.hypot(x, z);
      if (length === 0) {
        return;
      }

      camera.lookAt(
        camera.position.x + x / length,
        camera.position.y,
        camera.position.z + z / length
      );
    },
    stepSimulation: (delta: number, steps: number): void => {
      const safeDelta = Math.max(0, delta);
      const safeSteps = Math.max(0, Math.floor(steps));
      for (let index = 0; index < safeSteps; index += 1) {
        player.move(safeDelta);
        updateHeldObjectPosition(safeDelta);
      }
    },
    getHeldChipForwardRadius: (): number => HELD_CHIP_FORWARD_RADIUS
  };

  (window as unknown as { __zenventoryTestApi?: typeof testApi }).__zenventoryTestApi = testApi;
}

function renderLoop(): void {
  const delta = clock.getDelta();
  player.move(delta);
  updateHeldObjectPosition(delta);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(renderLoop);
