import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { ROOM_BOUNDS } from "../../src/roomBounds";
import {
  HELD_CHIP_FORWARD_RADIUS,
  HELD_WALL_CLEARANCE_MARGIN,
  getDistanceToFacingWall,
  getSafeHeldForwardDistance
} from "../../src/wallProximity";

describe("wall proximity", () => {
  it("keeps desired hold distance when facing away from nearby wall", () => {
    const position = new Vector3(ROOM_BOUNDS.maxX, 1.6, 0);
    const worldForward = new Vector3(-1, 0, 0);

    const safeDistance = getSafeHeldForwardDistance(position, worldForward, 0.74);

    expect(safeDistance).toBe(0.74);
  });

  it("reduces hold distance when facing wall at movement boundary", () => {
    const position = new Vector3(ROOM_BOUNDS.maxX, 1.6, 0);
    const worldForward = new Vector3(1, 0, 0);

    const safeDistance = getSafeHeldForwardDistance(position, worldForward, 0.74);

    expect(safeDistance).toBeCloseTo(0.11, 8);
  });

  it("uses nearest wall when facing room corner diagonally", () => {
    const position = new Vector3(ROOM_BOUNDS.maxX, 1.6, ROOM_BOUNDS.maxZ);
    const worldForward = new Vector3(1, 0, 1);

    const distance = getDistanceToFacingWall(position, worldForward);

    expect(distance).toBeCloseTo(0.3 * Math.sqrt(2), 8);
  });

  it("never returns a negative safe hold distance", () => {
    const position = new Vector3(8.88, 1.6, 0);
    const worldForward = new Vector3(1, 0, 0);

    const safeDistance = getSafeHeldForwardDistance(position, worldForward, 0.74);

    expect(safeDistance).toBe(0);
  });

  it("accounts for chip radius and safety margin", () => {
    const position = new Vector3(ROOM_BOUNDS.maxX, 1.6, 0);
    const worldForward = new Vector3(1, 0, 0);

    const safeDistance = getSafeHeldForwardDistance(position, worldForward, 10);

    expect(safeDistance).toBeCloseTo(
      0.3 - HELD_CHIP_FORWARD_RADIUS - HELD_WALL_CLEARANCE_MARGIN,
      8
    );
  });
});
