import { Camera, Vector3 } from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { clampPositionToRoom } from "./roomBounds";

export interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export interface PlayerController {
  controls: PointerLockControls;
  keys: KeyState;
  move: (delta: number) => void;
}

const FORWARD = new Vector3();
const RIGHT = new Vector3();

export function createPlayer(camera: Camera, clickTarget: HTMLElement): PlayerController {
  const controls = new PointerLockControls(camera, clickTarget);
  const keys: KeyState = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };

  clickTarget.addEventListener("click", () => {
    if (!controls.isLocked) {
      controls.lock();
    }
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    setDirectionKeyState(event.code, keys, true);
  });

  window.addEventListener("keyup", (event: KeyboardEvent) => {
    setDirectionKeyState(event.code, keys, false);
  });

  return {
    controls,
    keys,
    move(delta: number): void {
      if (!controls.isLocked) {
        return;
      }

      applyMovementStep(camera, controls.object.position, keys, delta);
    }
  };
}

export function applyMovementStep(
  camera: Camera,
  position: Vector3,
  keys: KeyState,
  delta: number
): void {
  const speed = 3.8;
  const distance = speed * delta;

  camera.getWorldDirection(FORWARD);
  FORWARD.y = 0;
  FORWARD.normalize();

  RIGHT.crossVectors(FORWARD, camera.up).normalize();

  if (keys.forward) {
    position.addScaledVector(FORWARD, distance);
  }
  if (keys.backward) {
    position.addScaledVector(FORWARD, -distance);
  }
  if (keys.left) {
    position.addScaledVector(RIGHT, -distance);
  }
  if (keys.right) {
    position.addScaledVector(RIGHT, distance);
  }

  clampPositionToRoom(position);
}

function setDirectionKeyState(code: string, keys: KeyState, isDown: boolean): void {
  if (code === "KeyW") {
    keys.forward = isDown;
    return;
  }
  if (code === "KeyS") {
    keys.backward = isDown;
    return;
  }
  if (code === "KeyA") {
    keys.left = isDown;
    return;
  }
  if (code === "KeyD") {
    keys.right = isDown;
  }
}
