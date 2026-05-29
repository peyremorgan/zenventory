import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { applyMovementStep } from "../../src/player";
import { ROOM_BOUNDS } from "../../src/roomBounds";

describe("player movement step", () => {
  function createCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 1.6, 0);
    camera.lookAt(new Vector3(0, 1.6, -1));
    return camera;
  }

  it("moves forward along look direction", () => {
    const camera = createCamera();

    applyMovementStep(
      camera,
      camera.position,
      { forward: true, backward: false, left: false, right: false },
      0.5
    );

    expect(camera.position.z).toBeCloseTo(-1.9, 8);
    expect(camera.position.x).toBeCloseTo(0, 8);
  });

  it("clamps movement at right wall boundary", () => {
    const camera = createCamera();
    camera.position.set(ROOM_BOUNDS.maxX - 0.01, 1.6, 0);

    applyMovementStep(
      camera,
      camera.position,
      { forward: false, backward: false, left: false, right: true },
      2
    );

    expect(camera.position.x).toBe(ROOM_BOUNDS.maxX);
  });

  it("supports diagonal input while staying in room", () => {
    const camera = createCamera();
    camera.position.set(ROOM_BOUNDS.maxX - 0.2, 1.6, ROOM_BOUNDS.minZ + 0.2);

    applyMovementStep(
      camera,
      camera.position,
      { forward: true, backward: false, left: false, right: true },
      2
    );

    expect(camera.position.x).toBe(ROOM_BOUNDS.maxX);
    expect(camera.position.z).toBe(ROOM_BOUNDS.minZ);
  });
});
