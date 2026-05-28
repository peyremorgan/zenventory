import { Clock, PerspectiveCamera, Raycaster, Scene, Vector2, WebGLRenderer } from "three";
import { createHud } from "./hud";
import { createPlayer } from "./player";
import { placeItem, pickItem, type ShelfZone, type SortItem } from "./sorting";
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
const hud = createHud(1);

const raycaster = new Raycaster();
const screenCenter = new Vector2(0, 0);
const clock = new Clock();

const bookMaterialDefault = room.itemMesh.material;
const shelfMaterialDefault = room.shelfMesh.material;

const item: SortItem = {
  id: "book-1",
  category: "alchemy",
  isHeld: false,
  isPlaced: false
};

const shelf: ShelfZone = {
  id: "shelf-1",
  acceptsCategory: "alchemy"
};

let sortedCount = 0;
hud.update(sortedCount);

function updateHeldObjectPosition(): void {
  if (!item.isHeld) {
    return;
  }

  const target = room.holdOffset.clone();
  target.applyQuaternion(camera.quaternion);
  target.add(camera.position);
  room.itemMesh.position.copy(target);
  room.itemMesh.quaternion.copy(camera.quaternion);
}

function tryInteract(): void {
  raycaster.setFromCamera(screenCenter, camera);
  const intersections = raycaster.intersectObjects([room.itemMesh, room.shelfMesh], false);
  const first = intersections[0]?.object;

  if (!first) {
    return;
  }

  if (first === room.itemMesh && !item.isPlaced && !item.isHeld) {
    const next = pickItem(item);
    item.isHeld = next.isHeld;
    (room.itemMesh.material as typeof bookMaterialDefault) = shelfMaterialDefault;
    return;
  }

  if (first === room.shelfMesh && item.isHeld && !item.isPlaced) {
    const next = placeItem(item, shelf);
    const wasPlaced = item.isPlaced;
    item.isHeld = next.isHeld;
    item.isPlaced = next.isPlaced;

    if (!wasPlaced && item.isPlaced) {
      room.itemMesh.position.copy(room.placePosition);
      room.itemMesh.rotation.set(0, 0, 0);
      (room.itemMesh.material as typeof bookMaterialDefault) = bookMaterialDefault;
      sortedCount = 1;
      hud.update(sortedCount);
    }
  }
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
    triggerPick: (): void => {
      if (!item.isPlaced) {
        const next = pickItem(item);
        item.isHeld = next.isHeld;
      }
    },
    triggerPlace: (): void => {
      const next = placeItem(item, shelf);
      const wasPlaced = item.isPlaced;
      item.isHeld = next.isHeld;
      item.isPlaced = next.isPlaced;
      if (!wasPlaced && item.isPlaced) {
        room.itemMesh.position.copy(room.placePosition);
        room.itemMesh.rotation.set(0, 0, 0);
        sortedCount = 1;
        hud.update(sortedCount);
      }
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
