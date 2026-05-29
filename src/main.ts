import { Clock, Mesh, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import { createHud } from "./hud";
import {
  DEFAULT_THROW_TUNING,
  createChipRigidBody,
  setThrownState,
  stepChipRigidBody,
  syncRigidBodyTransform,
  type ChipRigidBody
} from "./physics";
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
const gameCanvas = canvas;

const renderer = new WebGLRenderer({ canvas: gameCanvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new Scene();
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 1.8);
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

async function bootstrap(): Promise<void> {
  const room = await setupScene(scene);
  const player = createPlayer(camera, gameCanvas);
  const hud = createHud(room.chipMeshes.length);

  const raycaster = new Raycaster();
  const screenCenter = new Vector2(0, 0);
  const clock = new Clock();

  const chips: Chip[] = room.chipSpawnColors.map((color, index) => ({
    id: `chip-${color}-${index}`,
    color,
    isPlaced: false,
    isHeld: false,
    isThrown: false,
    placedColumnIndex: null
  }));
  const chipBodies: ChipRigidBody[] = room.chipMeshes.map((chipMesh) =>
    createChipRigidBody(chipMesh.position, chipMesh.quaternion)
  );

  let sortedCount = 0;
  let heldChipIndices: number[] = [];
  let heldForwardDistance = -room.holdOffset.z;
  hud.update(sortedCount);
  hud.updateHeldCount(heldChipIndices.length);

  const worldForward = new Vector3();
  const worldRight = new Vector3();
  const chipAxisScratch = new Vector3();

  function stopChipPhysics(chipIndex: number): void {
    const body = chipBodies[chipIndex];
    const chipMesh = room.chipMeshes[chipIndex];
    if (!body || !chipMesh) {
      return;
    }

    syncRigidBodyTransform(body, chipMesh.position, chipMesh.quaternion);
    body.linearVelocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.isSimulating = false;
    body.restFrames = 0;
  }

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
    stopChipPhysics(chipIndex);
    placedMesh.rotation.set(0, 0, 0);
    placedMesh.position.set(
      columnMesh.position.x,
      stackChipCenterY(room.columnStackBaseY, room.chipHeight, stackedCount),
      columnMesh.position.z
    );
    heldChipIndices = heldChipIndices.slice(0, -1);
    hud.updateHeldCount(heldChipIndices.length);

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
      stopChipPhysics(chipIndex);
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
      stopChipPhysics(chipIndex);
      heldChipIndices = [...heldChipIndices, chipIndex];
      hud.updateHeldCount(heldChipIndices.length);
    }
  }

  function tryThrowTopHeldChip(): boolean {
    const chipsHeldBeforeThrow = heldChipIndices.length;
    const topChipIndex = heldChipIndices[heldChipIndices.length - 1];
    if (topChipIndex === undefined) {
      return false;
    }

    const chip = chips[topChipIndex];
    const chipMesh = room.chipMeshes[topChipIndex];
    const body = chipBodies[topChipIndex];
    if (!chip || !chipMesh || !body) {
      return false;
    }

    chips[topChipIndex] = {
      ...chip,
      isHeld: false,
      isPlaced: false,
      isThrown: true,
      placedColumnIndex: null
    };
    heldChipIndices = heldChipIndices.slice(0, -1);
    hud.updateHeldCount(heldChipIndices.length);

    syncRigidBodyTransform(body, chipMesh.position, chipMesh.quaternion);
    camera.getWorldDirection(worldForward);
    worldForward.y = 0;
    if (worldForward.lengthSq() <= 1e-8) {
      worldForward.set(0, 0, -1);
    } else {
      worldForward.normalize();
    }

    worldRight.crossVectors(worldForward, camera.up).normalize();
    setThrownState(body, worldForward, worldRight, DEFAULT_THROW_TUNING, chipsHeldBeforeThrow);
    return true;
  }

  function updateThrownPhysics(delta: number): void {
    const safeDelta = Math.max(0, delta);
    if (safeDelta <= 0) {
      return;
    }

    for (let chipIndex = 0; chipIndex < chips.length; chipIndex += 1) {
      const chip = chips[chipIndex];
      if (!chip || !chip.isThrown) {
        continue;
      }

      const chipMesh = room.chipMeshes[chipIndex];
      const body = chipBodies[chipIndex];
      if (!chipMesh || !body) {
        continue;
      }

      stepChipRigidBody(body, room.physicsEnvironment, safeDelta);
      chipMesh.position.copy(body.position);
      chipMesh.quaternion.copy(body.quaternion);

      if (!body.isSimulating) {
        chips[chipIndex] = {
          ...chip,
          isThrown: false
        };
      }
    }
  }

  gameCanvas.addEventListener("mousedown", () => {
    tryInteract();
  });

  gameCanvas.addEventListener(
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

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.code !== "KeyF" || event.repeat) {
      return;
    }
    if (!player.controls.isLocked) {
      return;
    }

    tryThrowTopHeldChip();
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
        stopChipPhysics(chipIndex);
        heldChipIndices = [...heldChipIndices, chipIndex];
        hud.updateHeldCount(heldChipIndices.length);
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
      triggerThrowTopChip: (): boolean => tryThrowTopHeldChip(),
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
      getChipPosition: (chipIndex: number): { x: number; y: number; z: number } | null => {
        const chipMesh = room.chipMeshes[chipIndex];
        if (!chipMesh) {
          return null;
        }

        return {
          x: chipMesh.position.x,
          y: chipMesh.position.y,
          z: chipMesh.position.z
        };
      },
      getChipLinearSpeed: (chipIndex: number): number => chipBodies[chipIndex]?.linearVelocity.length() ?? 0,
      getChipAngularSpeed: (chipIndex: number): number => chipBodies[chipIndex]?.angularVelocity.length() ?? 0,
      getChipUpAlignment: (chipIndex: number): number | null => {
        const chipMesh = room.chipMeshes[chipIndex];
        if (!chipMesh) {
          return null;
        }

        chipAxisScratch.set(0, 1, 0).applyQuaternion(chipMesh.quaternion).normalize();
        return Math.abs(chipAxisScratch.y);
      },
      isChipThrown: (chipIndex: number): boolean => Boolean(chips[chipIndex]?.isThrown),
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
      getTableMaterialSamples: (): Record<string, { r: number; g: number; b: number }> => {
        const samples: Record<string, { r: number; g: number; b: number }> = {};
        const tableMaterialNames = new Set(["cloth", "cushion", "wood"]);

        scene.traverse((node) => {
          if (!(node instanceof Mesh)) {
            return;
          }

          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const material of materials) {
            if (!(material.name in samples) && tableMaterialNames.has(material.name)) {
              const color = (
                material as unknown as {
                  color?: { r: number; g: number; b: number };
                }
              ).color;

              if (color) {
                samples[material.name] = { r: color.r, g: color.g, b: color.b };
              }
            }
          }
        });

        return samples;
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
          updateThrownPhysics(safeDelta);
        }
      },
      getHeldChipForwardRadius: (): number => HELD_CHIP_FORWARD_RADIUS,
      isUsingExternalAssets: (): boolean => room.usingExternalAssets
    };

    (window as unknown as { __zenventoryTestApi?: typeof testApi }).__zenventoryTestApi = testApi;
  }

  function renderLoop(): void {
    const delta = clock.getDelta();
    player.move(delta);
    updateHeldObjectPosition(delta);
    updateThrownPhysics(delta);
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(renderLoop);
}

void bootstrap();
