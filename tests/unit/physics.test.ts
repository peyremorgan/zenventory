import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  createChipRigidBody,
  setThrownState,
  stepChipRigidBody,
  type PhysicsEnvironment
} from "../../src/physics";

function createEnvironment(overrides: Partial<PhysicsEnvironment> = {}): PhysicsEnvironment {
  return {
    floorY: 0,
    tableTopY: 0.8,
    tableCenterX: 0,
    tableCenterZ: 0,
    tableRadius: 1.5,
    wallBounds: {
      minX: -2,
      maxX: 2,
      minZ: -2,
      maxZ: 2
    },
    ...overrides
  };
}

describe("chip rigid body", () => {
  it("sets fixed throw velocity and spin", () => {
    const body = createChipRigidBody(new Vector3(0, 1, 0), new Quaternion());

    setThrownState(body, new Vector3(0, 0, -1), new Vector3(1, 0, 0));

    expect(body.isSimulating).toBe(true);
    expect(body.linearVelocity.length()).toBeGreaterThan(0);
    expect(body.angularVelocity.length()).toBeGreaterThan(0);
  });

  it("applies gravity while simulating", () => {
    const body = createChipRigidBody(new Vector3(0, 2, 0), new Quaternion());
    body.isSimulating = true;

    const env = createEnvironment({ floorY: -5, tableTopY: -10, tableRadius: 0 });
    stepChipRigidBody(body, env, 0.1);

    expect(body.linearVelocity.y).toBeLessThan(0);
    expect(body.position.y).toBeLessThan(2);
  });

  it("bounces on floor plane", () => {
    const body = createChipRigidBody(new Vector3(0, 0.04, 0), new Quaternion());
    body.isSimulating = true;
    body.linearVelocity.set(0, -2, 0);

    const env = createEnvironment({ tableTopY: -10, tableRadius: 0 });
    stepChipRigidBody(body, env, 0.1);

    expect(body.position.y).toBeGreaterThanOrEqual(body.halfHeight - 1e-6);
    expect(body.linearVelocity.y).toBeGreaterThanOrEqual(0);
  });

  it("bounces on wall bounds", () => {
    const body = createChipRigidBody(new Vector3(1.9, 1.2, 0), new Quaternion());
    body.isSimulating = true;
    body.linearVelocity.set(6, 0, 0);

    const env = createEnvironment({ tableTopY: -10, tableRadius: 0, wallBounds: {
      minX: -2,
      maxX: 2,
      minZ: -2,
      maxZ: 2
    } });
    stepChipRigidBody(body, env, 0.1);

    expect(body.position.x).toBeLessThanOrEqual(env.wallBounds.maxX - body.radius + 1e-6);
    expect(body.linearVelocity.x).toBeLessThan(0);
  });

  it("does not collide with table top outside table radius", () => {
    const body = createChipRigidBody(new Vector3(2.2, 0.84, 0), new Quaternion());
    body.isSimulating = true;
    body.linearVelocity.set(0, -1, 0);

    const env = createEnvironment({ tableRadius: 1.5, tableTopY: 0.8, floorY: -5 });
    stepChipRigidBody(body, env, 0.1);

    expect(body.position.y).toBeLessThan(0.8);
  });

  it("integrates orientation from angular velocity", () => {
    const body = createChipRigidBody(new Vector3(0, 3, 0), new Quaternion());
    body.isSimulating = true;
    body.angularVelocity.set(0, 8, 0);

    const env = createEnvironment({ floorY: -5, tableTopY: -10, tableRadius: 0 });
    const before = body.quaternion.clone();
    stepChipRigidBody(body, env, 0.1);

    expect(body.quaternion.equals(before)).toBe(false);
    expect(Math.abs(body.quaternion.length() - 1)).toBeLessThan(1e-6);
  });

  it("applies settling torque for tilted chip on floor contact", () => {
    const body = createChipRigidBody(
      new Vector3(0, 0.1, 0),
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4)
    );
    body.isSimulating = true;

    const env = createEnvironment({ tableTopY: -10, tableRadius: 0 });
    stepChipRigidBody(body, env, 1 / 60);

    expect(Math.abs(body.angularVelocity.z)).toBeGreaterThan(0.01);
  });

  it("does not apply settling torque while airborne", () => {
    const body = createChipRigidBody(
      new Vector3(0, 1.2, 0),
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4)
    );
    body.isSimulating = true;

    const env = createEnvironment({ floorY: -5, tableTopY: -10, tableRadius: 0 });
    stepChipRigidBody(body, env, 1 / 60);

    expect(body.angularVelocity.lengthSq()).toBeLessThan(1e-8);
  });

  it("keeps flat chip stable on floor contact", () => {
    const body = createChipRigidBody(new Vector3(0, 0.03, 0), new Quaternion());
    body.isSimulating = true;

    const env = createEnvironment({ tableTopY: -10, tableRadius: 0 });
    stepChipRigidBody(body, env, 1 / 60);

    expect(body.angularVelocity.length()).toBeLessThan(1e-4);
  });
});
