import { describe, expect, it } from "vitest";
import {
  CHIP_HALF_HEIGHT,
  CHIP_HEIGHT,
  CHIP_RADIUS,
  CHIP_SPAWN_INNER_RING_RADIUS,
  CHIP_SPAWN_OUTER_RING_RADIUS
} from "../../src/chipMetrics";

describe("chip metrics", () => {
  it("uses the requested 20 percent size reduction", () => {
    expect(CHIP_RADIUS).toBeCloseTo(0.136, 10);
    expect(CHIP_HEIGHT).toBeCloseTo(0.048, 10);
    expect(CHIP_HALF_HEIGHT).toBeCloseTo(0.024, 10);
  });

  it("spawns chips in the medium center cluster rings", () => {
    expect(CHIP_SPAWN_INNER_RING_RADIUS).toBeCloseTo(0.8, 10);
    expect(CHIP_SPAWN_OUTER_RING_RADIUS).toBeCloseTo(1.2, 10);
    expect(CHIP_SPAWN_INNER_RING_RADIUS).toBeLessThan(CHIP_SPAWN_OUTER_RING_RADIUS);
  });
});