import { Vector3 } from "three";

export interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const ROOM_HALF_EXTENT = 9;
const WALL_HALF_THICKNESS = 0.1;
export const PLAYER_RADIUS = 0.3;

const WALL_INNER_LIMIT = ROOM_HALF_EXTENT - WALL_HALF_THICKNESS;

const WALKABLE_LIMIT = ROOM_HALF_EXTENT - WALL_HALF_THICKNESS - PLAYER_RADIUS;

export const ROOM_BOUNDS: RoomBounds = {
  minX: -WALKABLE_LIMIT,
  maxX: WALKABLE_LIMIT,
  minZ: -WALKABLE_LIMIT,
  maxZ: WALKABLE_LIMIT
};

export const WALL_INNER_BOUNDS: RoomBounds = {
  minX: -WALL_INNER_LIMIT,
  maxX: WALL_INNER_LIMIT,
  minZ: -WALL_INNER_LIMIT,
  maxZ: WALL_INNER_LIMIT
};

// Walkable bounds stop camera movement early by player radius; this restores true wall planes.
export function toWallInnerBounds(roomBounds: RoomBounds = ROOM_BOUNDS): RoomBounds {
  return {
    minX: roomBounds.minX - PLAYER_RADIUS,
    maxX: roomBounds.maxX + PLAYER_RADIUS,
    minZ: roomBounds.minZ - PLAYER_RADIUS,
    maxZ: roomBounds.maxZ + PLAYER_RADIUS
  };
}

// Player movement is constrained on the horizontal plane; camera height is managed elsewhere.
export function clampPositionToRoom(position: Vector3, bounds: RoomBounds = ROOM_BOUNDS): void {
  position.x = clamp(position.x, bounds.minX, bounds.maxX);
  position.z = clamp(position.z, bounds.minZ, bounds.maxZ);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}