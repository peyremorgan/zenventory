import { Matrix3, Quaternion, Vector3 } from "three";
import type { RoomBounds } from "./roomBounds";

export interface PhysicsEnvironment {
  floorY: number;
  tableTopY: number;
  tableCenterX: number;
  tableCenterZ: number;
  tableRadius: number;
  wallBounds: RoomBounds;
}

export interface ChipRigidBody {
  position: Vector3;
  quaternion: Quaternion;
  linearVelocity: Vector3;
  angularVelocity: Vector3;
  mass: number;
  inverseMass: number;
  radius: number;
  halfHeight: number;
  restitution: number;
  friction: number;
  linearDamping: number;
  angularDamping: number;
  isSimulating: boolean;
  restFrames: number;
  lastSurfaceNormal: Vector3 | null;
}

export interface ThrowTuning {
  throwSpeed: number;
  upBias: number;
  sideSpin: number;
  forwardSpin: number;
}

export const DEFAULT_THROW_TUNING: ThrowTuning = {
  throwSpeed: 6.4,
  upBias: 0.2,
  sideSpin: 14.4,
  forwardSpin: 7.2
};

const EPSILON = 1e-6;
const SLEEP_LINEAR_THRESHOLD = 0.2;
const SLEEP_ANGULAR_THRESHOLD = 0.6;
const SLEEP_FRAMES = 18;
const SETTLING_TORQUE_STRENGTH = 0.08;
const SETTLING_LINEAR_SPEED_MAX = 1.2;
const SETTLING_ANGULAR_SPEED_MAX = 9;
const SETTLING_ALIGNMENT_EPSILON = 1e-3;

const AXIS_Y = new Vector3(0, 1, 0);
const WORLD_UP = new Vector3(0, 1, 0);
const NORMAL_NEG_X = new Vector3(-1, 0, 0);
const NORMAL_POS_X = new Vector3(1, 0, 0);
const NORMAL_NEG_Z = new Vector3(0, 0, -1);
const NORMAL_POS_Z = new Vector3(0, 0, 1);

const scratchBodyAxis = new Vector3();
const scratchContact = new Vector3();
const scratchR = new Vector3();
const scratchContactVelocity = new Vector3();
const scratchNormalComponent = new Vector3();
const scratchTangent = new Vector3();
const scratchImpulse = new Vector3();
const scratchCross = new Vector3();
const scratchDenom = new Vector3();
const scratchRotation = new Matrix3();
const scratchRotationTranspose = new Matrix3();
const scratchQuat = new Quaternion();
const scratchForward = new Vector3();
const scratchRight = new Vector3();
const scratchUp = new Vector3();
const scratchSettlingAxis = new Vector3();
const scratchSettlingTorque = new Vector3();
const scratchSettlingAngularAccel = new Vector3();

export function createChipRigidBody(position: Vector3, quaternion: Quaternion): ChipRigidBody {
  const mass = 0.012;
  return {
    position: position.clone(),
    quaternion: quaternion.clone(),
    linearVelocity: new Vector3(),
    angularVelocity: new Vector3(),
    mass,
    inverseMass: 1 / mass,
    radius: 0.17,
    halfHeight: 0.03,
    restitution: 0.28,
    friction: 0.52,
    linearDamping: 0.8,
    angularDamping: 1.1,
    isSimulating: false,
    restFrames: 0,
    lastSurfaceNormal: null
  };
}

export function syncRigidBodyTransform(
  body: ChipRigidBody,
  position: Vector3,
  quaternion: Quaternion
): void {
  body.position.copy(position);
  body.quaternion.copy(quaternion).normalize();
}

export function setThrownState(
  body: ChipRigidBody,
  cameraForward: Vector3,
  cameraRight: Vector3,
  tuning: ThrowTuning = DEFAULT_THROW_TUNING
): void {
  const forward = scratchForward.copy(cameraForward);
  if (forward.lengthSq() < EPSILON) {
    forward.set(0, 0, -1);
  }
  forward.normalize();

  const right = scratchRight.copy(cameraRight);
  if (right.lengthSq() < EPSILON) {
    right.set(1, 0, 0);
  }
  right.normalize();

  const throwDirection = scratchUp.copy(forward).addScaledVector(WORLD_UP, tuning.upBias).normalize();

  body.linearVelocity.copy(throwDirection).multiplyScalar(tuning.throwSpeed);
  body.angularVelocity
    .copy(right)
    .multiplyScalar(tuning.sideSpin)
    .addScaledVector(forward, tuning.forwardSpin);
  body.isSimulating = true;
  body.restFrames = 0;
  body.lastSurfaceNormal = null;
}

export function stepChipRigidBody(body: ChipRigidBody, env: PhysicsEnvironment, delta: number): boolean {
  if (!body.isSimulating) {
    return false;
  }

  const dt = Math.max(0, Math.min(delta, 1 / 30));
  if (dt <= 0) {
    return false;
  }

  body.linearVelocity.y -= 9.81 * dt;

  const linearDecay = Math.exp(-body.linearDamping * dt);
  const angularDecay = Math.exp(-body.angularDamping * dt);
  body.linearVelocity.multiplyScalar(linearDecay);
  body.angularVelocity.multiplyScalar(angularDecay);

  body.position.addScaledVector(body.linearVelocity, dt);
  integrateOrientation(body.quaternion, body.angularVelocity, dt);

  body.lastSurfaceNormal = null;
  let hadCollision = false;

  hadCollision =
    resolvePlaneCollision(body, WORLD_UP, env.floorY, body.restitution, body.friction, true) || hadCollision;

  const dx = body.position.x - env.tableCenterX;
  const dz = body.position.z - env.tableCenterZ;
  const centerInsideTable = dx * dx + dz * dz <= env.tableRadius * env.tableRadius;
  if (centerInsideTable) {
    hadCollision =
      resolvePlaneCollision(body, WORLD_UP, env.tableTopY, body.restitution, body.friction, true) || hadCollision;
  }

  hadCollision =
    resolveWallMaxX(body, env.wallBounds.maxX, body.restitution, body.friction) || hadCollision;
  hadCollision =
    resolveWallMinX(body, env.wallBounds.minX, body.restitution, body.friction) || hadCollision;
  hadCollision =
    resolveWallMaxZ(body, env.wallBounds.maxZ, body.restitution, body.friction) || hadCollision;
  hadCollision =
    resolveWallMinZ(body, env.wallBounds.minZ, body.restitution, body.friction) || hadCollision;

  if (body.lastSurfaceNormal) {
    applySettlingTorque(body, body.lastSurfaceNormal, dt);
  }

  if (hadCollision) {
    const linearSpeedSq = body.linearVelocity.lengthSq();
    const angularSpeedSq = body.angularVelocity.lengthSq();

    if (
      linearSpeedSq <= SLEEP_LINEAR_THRESHOLD * SLEEP_LINEAR_THRESHOLD &&
      angularSpeedSq <= SLEEP_ANGULAR_THRESHOLD * SLEEP_ANGULAR_THRESHOLD
    ) {
      body.restFrames += 1;
      if (body.restFrames >= SLEEP_FRAMES) {
        body.linearVelocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        body.isSimulating = false;
        body.restFrames = 0;
      }
    } else {
      body.restFrames = 0;
    }
  } else {
    body.restFrames = 0;
  }

  return hadCollision;
}

function integrateOrientation(quaternion: Quaternion, angularVelocity: Vector3, dt: number): void {
  if (angularVelocity.lengthSq() < EPSILON) {
    return;
  }

  scratchQuat.set(
    angularVelocity.x * dt * 0.5,
    angularVelocity.y * dt * 0.5,
    angularVelocity.z * dt * 0.5,
    0
  );
  scratchQuat.multiply(quaternion);

  quaternion.x += scratchQuat.x;
  quaternion.y += scratchQuat.y;
  quaternion.z += scratchQuat.z;
  quaternion.w += scratchQuat.w;
  quaternion.normalize();
}

function resolvePlaneCollision(
  body: ChipRigidBody,
  normal: Vector3,
  planeOffset: number,
  restitution: number,
  friction: number,
  trackSurface: boolean = false
): boolean {
  const extent = cylinderExtentAlongNormal(body, normal);
  const projected = body.position.dot(normal);
  const minProjected = projected - extent;
  if (minProjected >= planeOffset) {
    return false;
  }

  const penetration = planeOffset - minProjected;
  body.position.addScaledVector(normal, penetration);

  if (trackSurface && body.lastSurfaceNormal === null) {
    body.lastSurfaceNormal = normal;
  }

  scratchContact.copy(normal).multiplyScalar(-extent).add(body.position);
  applyCollisionImpulse(body, normal, scratchContact, restitution, friction);
  return true;
}

function resolveWallMaxX(
  body: ChipRigidBody,
  maxX: number,
  restitution: number,
  friction: number
): boolean {
  const extent = cylinderExtentAlongAxis(body, 1, 0, 0);
  const maxProjected = body.position.x + extent;
  if (maxProjected <= maxX) {
    return false;
  }

  body.position.x -= maxProjected - maxX;
  scratchContact.set(body.position.x + extent, body.position.y, body.position.z);
  applyCollisionImpulse(body, NORMAL_NEG_X, scratchContact, restitution, friction);
  return true;
}

function resolveWallMinX(
  body: ChipRigidBody,
  minX: number,
  restitution: number,
  friction: number
): boolean {
  const extent = cylinderExtentAlongAxis(body, 1, 0, 0);
  const minProjected = body.position.x - extent;
  if (minProjected >= minX) {
    return false;
  }

  body.position.x += minX - minProjected;
  scratchContact.set(body.position.x - extent, body.position.y, body.position.z);
  applyCollisionImpulse(body, NORMAL_POS_X, scratchContact, restitution, friction);
  return true;
}

function resolveWallMaxZ(
  body: ChipRigidBody,
  maxZ: number,
  restitution: number,
  friction: number
): boolean {
  const extent = cylinderExtentAlongAxis(body, 0, 0, 1);
  const maxProjected = body.position.z + extent;
  if (maxProjected <= maxZ) {
    return false;
  }

  body.position.z -= maxProjected - maxZ;
  scratchContact.set(body.position.x, body.position.y, body.position.z + extent);
  applyCollisionImpulse(body, NORMAL_NEG_Z, scratchContact, restitution, friction);
  return true;
}

function resolveWallMinZ(
  body: ChipRigidBody,
  minZ: number,
  restitution: number,
  friction: number
): boolean {
  const extent = cylinderExtentAlongAxis(body, 0, 0, 1);
  const minProjected = body.position.z - extent;
  if (minProjected >= minZ) {
    return false;
  }

  body.position.z += minZ - minProjected;
  scratchContact.set(body.position.x, body.position.y, body.position.z - extent);
  applyCollisionImpulse(body, NORMAL_POS_Z, scratchContact, restitution, friction);
  return true;
}

function cylinderExtentAlongAxis(body: ChipRigidBody, x: number, y: number, z: number): number {
  const axis = scratchBodyAxis.copy(AXIS_Y).applyQuaternion(body.quaternion).normalize();
  const dot = Math.max(-1, Math.min(1, axis.x * x + axis.y * y + axis.z * z));
  const radial = Math.sqrt(Math.max(0, 1 - dot * dot));
  return Math.abs(dot) * body.halfHeight + radial * body.radius;
}

function cylinderExtentAlongNormal(body: ChipRigidBody, normal: Vector3): number {
  const axis = scratchBodyAxis.copy(AXIS_Y).applyQuaternion(body.quaternion).normalize();
  const dot = Math.max(-1, Math.min(1, axis.dot(normal)));
  const radial = Math.sqrt(Math.max(0, 1 - dot * dot));
  return Math.abs(dot) * body.halfHeight + radial * body.radius;
}

function applySettlingTorque(body: ChipRigidBody, surfaceNormal: Vector3, dt: number): void {
  if (
    body.linearVelocity.lengthSq() > SETTLING_LINEAR_SPEED_MAX * SETTLING_LINEAR_SPEED_MAX ||
    body.angularVelocity.lengthSq() > SETTLING_ANGULAR_SPEED_MAX * SETTLING_ANGULAR_SPEED_MAX
  ) {
    return;
  }

  const axis = scratchSettlingAxis.copy(AXIS_Y).applyQuaternion(body.quaternion).normalize();
  const misalignmentVector = scratchSettlingTorque.crossVectors(axis, surfaceNormal);
  const misalignment = misalignmentVector.length();
  if (misalignment <= SETTLING_ALIGNMENT_EPSILON) {
    return;
  }

  const torqueMagnitude = SETTLING_TORQUE_STRENGTH * body.mass * 9.81 * body.radius * misalignment;
  misalignmentVector.multiplyScalar(torqueMagnitude / misalignment);

  applyInverseInertiaWorld(body, misalignmentVector, scratchSettlingAngularAccel);
  body.angularVelocity.addScaledVector(scratchSettlingAngularAccel, dt);
}

function applyCollisionImpulse(
  body: ChipRigidBody,
  normal: Vector3,
  contactPoint: Vector3,
  restitution: number,
  friction: number
): void {
  scratchR.copy(contactPoint).sub(body.position);
  scratchContactVelocity
    .copy(body.angularVelocity)
    .cross(scratchR)
    .add(body.linearVelocity);

  const normalVelocity = scratchContactVelocity.dot(normal);
  if (normalVelocity >= 0) {
    return;
  }

  const normalImpulseMagnitude =
    (-(1 + restitution) * normalVelocity) /
    computeEffectiveMass(body, scratchR, normal);

  scratchImpulse.copy(normal).multiplyScalar(normalImpulseMagnitude);
  applyImpulse(body, scratchR, scratchImpulse);

  scratchContactVelocity
    .copy(body.angularVelocity)
    .cross(scratchR)
    .add(body.linearVelocity);

  scratchNormalComponent.copy(normal).multiplyScalar(scratchContactVelocity.dot(normal));
  scratchTangent.copy(scratchContactVelocity).sub(scratchNormalComponent);
  const tangentSpeed = scratchTangent.length();
  if (tangentSpeed <= EPSILON) {
    return;
  }

  scratchTangent.multiplyScalar(1 / tangentSpeed);

  const tangentImpulseMagnitude =
    -tangentSpeed / computeEffectiveMass(body, scratchR, scratchTangent);
  const maxFrictionImpulse = friction * normalImpulseMagnitude;
  const clampedTangentImpulse = clamp(
    tangentImpulseMagnitude,
    -maxFrictionImpulse,
    maxFrictionImpulse
  );

  scratchImpulse.copy(scratchTangent).multiplyScalar(clampedTangentImpulse);
  applyImpulse(body, scratchR, scratchImpulse);
}

function computeEffectiveMass(body: ChipRigidBody, radius: Vector3, direction: Vector3): number {
  scratchCross.copy(radius).cross(direction);
  applyInverseInertiaWorld(body, scratchCross, scratchDenom);
  scratchDenom.cross(radius);
  return Math.max(EPSILON, body.inverseMass + direction.dot(scratchDenom));
}

function applyImpulse(body: ChipRigidBody, radius: Vector3, impulse: Vector3): void {
  body.linearVelocity.addScaledVector(impulse, body.inverseMass);

  scratchCross.copy(radius).cross(impulse);
  applyInverseInertiaWorld(body, scratchCross, scratchDenom);
  body.angularVelocity.add(scratchDenom);
}

function applyInverseInertiaWorld(body: ChipRigidBody, vector: Vector3, target: Vector3): void {
  // Build world-space inverse inertia tensor from current orientation.
  const q = body.quaternion;
  const x = q.x;
  const y = q.y;
  const z = q.z;
  const w = q.w;

  const r00 = 1 - 2 * (y * y + z * z);
  const r01 = 2 * (x * y - z * w);
  const r02 = 2 * (x * z + y * w);
  const r10 = 2 * (x * y + z * w);
  const r11 = 1 - 2 * (x * x + z * z);
  const r12 = 2 * (y * z - x * w);
  const r20 = 2 * (x * z - y * w);
  const r21 = 2 * (y * z + x * w);
  const r22 = 1 - 2 * (x * x + y * y);

  scratchRotation.set(r00, r01, r02, r10, r11, r12, r20, r21, r22);
  scratchRotationTranspose.copy(scratchRotation).transpose();

  const ixx = (1 / 12) * body.mass * (3 * body.radius * body.radius + 4 * body.halfHeight * body.halfHeight);
  const iyy = 0.5 * body.mass * body.radius * body.radius;
  const izz = ixx;

  const invIxx = ixx > EPSILON ? 1 / ixx : 0;
  const invIyy = iyy > EPSILON ? 1 / iyy : 0;
  const invIzz = izz > EPSILON ? 1 / izz : 0;

  const local = target.copy(vector).applyMatrix3(scratchRotationTranspose);
  local.set(local.x * invIxx, local.y * invIyy, local.z * invIzz);
  target.copy(local).applyMatrix3(scratchRotation);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
