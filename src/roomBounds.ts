import { Vector3 } from "three";

export interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const ROOM_HALF_EXTENT = 9;
const WALL_HALF_THICKNESS = 0.1;
const PLAYER_RADIUS = 0.3;

const WALKABLE_LIMIT = ROOM_HALF_EXTENT - WALL_HALF_THICKNESS - PLAYER_RADIUS;

export const ROOM_BOUNDS: RoomBounds = {
  minX: -WALKABLE_LIMIT,
  maxX: WALKABLE_LIMIT,
  minZ: -WALKABLE_LIMIT,
  maxZ: WALKABLE_LIMIT
};

export function clampPositionToRoom(position: Vector3, bounds: RoomBounds = ROOM_BOUNDS): void {
  position.x = clamp(position.x, bounds.minX, bounds.maxX);
  position.z = clamp(position.z, bounds.minZ, bounds.maxZ);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}