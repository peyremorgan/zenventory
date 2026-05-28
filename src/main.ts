import { Clock, PerspectiveCamera, Raycaster, Scene, Vector2, WebGLRenderer } from "three";
import { createHud } from "./hud";
import { createPlayer } from "./player";
import { canPlaceChip, canPickChip, placeChip, pickChip, type Chip } from "./sorting";
import { setupScene } from "./scene";

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
let heldChipIndex: number | null = null;
hud.update(sortedCount);

function placeHeldChipIntoColumn(chipIndex: number, columnIndex: number): boolean {
  const chip = chips[chipIndex];
  const column = room.columns[columnIndex];
  const columnMesh = room.caseColumns[columnIndex];
  if (!chip || !column || !columnMesh) {
    return false;
  }

  const wasPlaced = chip.isPlaced;
  const next = placeChip(chip, column);
  if (!canPlaceChip(chip, column) || next === chip) {
    return false;
  }

  chips[chipIndex] = next;
  const stackedCount = chips.filter(
    (placedChip) => placedChip.isPlaced && placedChip.placedColumnIndex === columnIndex
  ).length;
  const placedMesh = room.chipMeshes[chipIndex];
  placedMesh.rotation.set(Math.PI / 2, 0, 0);
  placedMesh.position.set(
    columnMesh.position.x,
    room.columnStackBaseY + (stackedCount - 1) * room.chipHeight,
    columnMesh.position.z
  );
  heldChipIndex = null;

  if (!wasPlaced) {
    sortedCount += 1;
    hud.update(sortedCount);
  }

  return true;
}

function updateHeldObjectPosition(): void {
  if (heldChipIndex === null) {
    return;
  }

  const heldMesh = room.chipMeshes[heldChipIndex];
  const target = room.holdOffset.clone();
  target.applyQuaternion(camera.quaternion);
  target.add(camera.position);
  heldMesh.position.copy(target);
  heldMesh.quaternion.copy(camera.quaternion);
}

function tryInteract(): void {
  raycaster.setFromCamera(screenCenter, camera);

  if (heldChipIndex === null) {
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
    const next = pickChip(current, null);
    if (canPickChip(current, null) && next !== current) {
      chips[chipIndex] = next;
      heldChipIndex = chipIndex;
    }
    return;
  }

  const heldChip = chips[heldChipIndex];
  const columnHits = raycaster.intersectObjects(room.caseColumns, false);
  const firstColumn = columnHits[0]?.object;
  if (!firstColumn) {
    return;
  }

  const columnIndex = firstColumn.userData.columnIndex;
  if (typeof columnIndex !== "number") {
    return;
  }

  const column = room.columns[columnIndex];
  if (!canPlaceChip(heldChip, column)) {
    return;
  }

  placeHeldChipIntoColumn(heldChipIndex, columnIndex);
}

canvas.addEventListener("mousedown", () => {
  tryInteract();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (typeof window !== "undefined") {
  const testApi = {
    getProgress: (): string => document.getElementById("hud")?.textContent ?? "",
    triggerPickChip: (chipIndex: number): boolean => {
      if (heldChipIndex !== null) {
        return false;
      }
      const chip = chips[chipIndex];
      if (!chip) {
        return false;
      }
      if (!canPickChip(chip, null)) {
        return false;
      }
      chips[chipIndex] = pickChip(chip, null);
      heldChipIndex = chipIndex;
      return true;
    },
    triggerPlaceColumn: (columnIndex: number): boolean => {
      if (heldChipIndex === null) {
        return false;
      }
      const heldChip = chips[heldChipIndex];
      const column = room.columns[columnIndex];
      if (!column || !canPlaceChip(heldChip, column)) {
        return false;
      }

      return placeHeldChipIntoColumn(heldChipIndex, columnIndex);
    },
    firstUnplacedChipByColor: (color: Chip["color"]): number => {
      for (let index = 0; index < chips.length; index += 1) {
        const chip = chips[index];
        if (chip.color === color && !chip.isPlaced && !chip.isHeld) {
          return index;
        }
      }
      return -1;
    }
  };

  (window as unknown as { __zenventoryTestApi?: typeof testApi }).__zenventoryTestApi = testApi;
}

function renderLoop(): void {
  const delta = clock.getDelta();
  player.move(delta);
  updateHeldObjectPosition();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(renderLoop);
