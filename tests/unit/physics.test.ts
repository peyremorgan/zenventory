import { Quaternion, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
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

  it("is fully precise when throwing the last chip", () => {
    const bodyA = createChipRigidBody(new Vector3(0, 1, 0), new Quaternion());
    const bodyB = createChipRigidBody(new Vector3(0, 1, 0), new Quaternion());

    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(1).mockReturnValue(0.37);

    setThrownState(bodyA, new Vector3(0, 0, -1), new Vector3(1, 0, 0), undefined, 1);
    setThrownState(bodyB, new Vector3(0, 0, -1), new Vector3(1, 0, 0), undefined, 1);

    expect(bodyA.linearVelocity.distanceTo(bodyB.linearVelocity)).toBeCloseTo(0, 10);
    expect(bodyA.angularVelocity.distanceTo(bodyB.angularVelocity)).toBeCloseTo(0, 10);
    expect(bodyA.linearVelocity.length()).toBeCloseTo(6.4, 10);

    randomSpy.mockRestore();
  });

  it("applies +/-3% throw force variation with two chips", () => {
    const bodyMin = createChipRigidBody(new Vector3(0, 1, 0), new Quaternion());
    const bodyMax = createChipRigidBody(new Vector3(0, 1, 0), new Quaternion());

    const randomSpy = vi.spyOn(Math, "random");
    randomSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5);

    setThrownState(bodyMin, new Vector3(0, 0, -1), new Vector3(1, 0, 0), undefined, 2);
    setThrownState(bodyMax, new Vector3(0, 0, -1), new Vector3(1, 0, 0), undefined, 2);

    expect(bodyMin.linearVelocity.length()).toBeCloseTo(6.4 * 0.97, 10);
    expect(bodyMax.linearVelocity.length()).toBeCloseTo(6.4 * 1.03, 10);

    randomSpy.mockRestore();
  });

  it("applies +/-9% throw force variation with four chips", () => {
    const bodyMin = createChipRigidBody(new Vector3(0, 1, 0), new Quaternion());
    const bodyMax = createChipRigidBody(new Vector3(0, 1, 0), new Quaternion());

    const randomSpy = vi.spyOn(Math, "random");
    randomSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5);

    setThrownState(bodyMin, new Vector3(0, 0, -1), new Vector3(1, 0, 0), undefined, 4);
    setThrownState(bodyMax, new Vector3(0, 0, -1), new Vector3(1, 0, 0), undefined, 4);

    expect(bodyMin.linearVelocity.length()).toBeCloseTo(6.4 * 0.91, 10);
    expect(bodyMax.linearVelocity.length()).toBeCloseTo(6.4 * 1.09, 10);

    randomSpy.mockRestore();
  });

  it("scales up and sideways throw bias with chip count", () => {
    const bodyLow = createChipRigidBody(new Vector3(0, 1, 0), new Quaternion());
    const bodyHigh = createChipRigidBody(new Vector3(0, 1, 0), new Quaternion());

    const randomSpy = vi.spyOn(Math, "random");
    randomSpy
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1);

    setThrownState(bodyLow, new Vector3(0, 0, -1), new Vector3(1, 0, 0), undefined, 2);
    setThrownState(bodyHigh, new Vector3(0, 0, -1), new Vector3(1, 0, 0), undefined, 4);

    const directionLow = bodyLow.linearVelocity.clone().normalize();
    const directionHigh = bodyHigh.linearVelocity.clone().normalize();

    expect(directionHigh.y).toBeGreaterThan(directionLow.y);
    expect(directionHigh.x).toBeGreaterThan(directionLow.x);

    randomSpy.mockRestore();
  });

  it("clamps randomization scale for chip counts above four", () => {
    const bodyFour = createChipRigidBody(new Vector3(0, 1, 0), new Quaternion());
    const bodyLarge = createChipRigidBody(new Vector3(0, 1, 0), new Quaternion());

    const randomSpy = vi.spyOn(Math, "random");
    randomSpy
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(1);

    setThrownState(bodyFour, new Vector3(0, 0, -1), new Vector3(1, 0, 0), undefined, 4);
    setThrownState(bodyLarge, new Vector3(0, 0, -1), new Vector3(1, 0, 0), undefined, 99);

    expect(bodyLarge.linearVelocity.distanceTo(bodyFour.linearVelocity)).toBeCloseTo(0, 10);

    randomSpy.mockRestore();
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

  it("does not freeze oscillating chip while settling torque is active", () => {
    const body = createChipRigidBody(
      new Vector3(0, 0.05, 0),
      new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 6)
    );
    body.isSimulating = true;

    const env = createEnvironment({ tableTopY: -10, tableRadius: 0 });

    for (let i = 0; i < 30; i++) {
      stepChipRigidBody(body, env, 1 / 60);
    }

    expect(body.isSimulating).toBe(true);
  });
});
