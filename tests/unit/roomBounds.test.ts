import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { ROOM_BOUNDS, clampPositionToRoom } from "../../src/roomBounds";

describe("room bounds collision", () => {
  it("keeps positions inside bounds unchanged", () => {
    const position = new Vector3(0, 1.6, 0);

    clampPositionToRoom(position);

    expect(position.x).toBe(0);
    expect(position.z).toBe(0);
  });

  it("clamps x and z independently to outer bounds", () => {
    const position = new Vector3(99, 1.6, -99);

    clampPositionToRoom(position);

    expect(position.x).toBe(ROOM_BOUNDS.maxX);
    expect(position.z).toBe(ROOM_BOUNDS.minZ);
  });

  it("leaves y untouched while clamping walk plane", () => {
    const position = new Vector3(-99, 2.75, 99);

    clampPositionToRoom(position);

    expect(position.y).toBe(2.75);
    expect(position.x).toBe(ROOM_BOUNDS.minX);
    expect(position.z).toBe(ROOM_BOUNDS.maxZ);
  });
});
