import { Vector3 } from "three";
import {
  ROOM_BOUNDS,
  WALL_INNER_BOUNDS,
  toWallInnerBounds,
  type RoomBounds
} from "./roomBounds";

const EPSILON = 1e-6;
const FORWARD_ON_PLANE = new Vector3();

export const HELD_CHIP_FORWARD_RADIUS = 0.17;
export const HELD_WALL_CLEARANCE_MARGIN = 0.02;

export function getDistanceToFacingWall(
  position: Vector3,
  worldForward: Vector3,
  wallBounds: RoomBounds = WALL_INNER_BOUNDS
): number {
  FORWARD_ON_PLANE.set(worldForward.x, 0, worldForward.z);
  if (FORWARD_ON_PLANE.lengthSq() < EPSILON) {
    return Number.POSITIVE_INFINITY;
  }

  FORWARD_ON_PLANE.normalize();

  const candidates: number[] = [];

  if (FORWARD_ON_PLANE.x > EPSILON) {
    candidates.push((wallBounds.maxX - position.x) / FORWARD_ON_PLANE.x);
  } else if (FORWARD_ON_PLANE.x < -EPSILON) {
    candidates.push((wallBounds.minX - position.x) / FORWARD_ON_PLANE.x);
  }

  if (FORWARD_ON_PLANE.z > EPSILON) {
    candidates.push((wallBounds.maxZ - position.z) / FORWARD_ON_PLANE.z);
  } else if (FORWARD_ON_PLANE.z < -EPSILON) {
    candidates.push((wallBounds.minZ - position.z) / FORWARD_ON_PLANE.z);
  }

  const positiveCandidates = candidates.filter((value) => value >= 0);
  if (positiveCandidates.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(...positiveCandidates);
}

export function getSafeHeldForwardDistance(
  position: Vector3,
  worldForward: Vector3,
  desiredForwardDistance: number,
  roomBounds: RoomBounds = ROOM_BOUNDS
): number {
  const distanceToWall = getDistanceToFacingWall(
    position,
    worldForward,
    toWallInnerBounds(roomBounds)
  );

  if (!Number.isFinite(distanceToWall)) {
    return desiredForwardDistance;
  }

  const safeForwardDistance = Math.max(
    0,
    distanceToWall - HELD_CHIP_FORWARD_RADIUS - HELD_WALL_CLEARANCE_MARGIN
  );

  return Math.min(desiredForwardDistance, safeForwardDistance);
}

export function damp(current: number, target: number, smoothing: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-smoothing * delta));
}
