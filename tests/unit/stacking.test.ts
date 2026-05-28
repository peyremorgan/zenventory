import { describe, expect, it } from "vitest";
import { stackChipCenterY } from "../../src/stacking";

describe("stackChipCenterY", () => {
  it("places first chip one chip height above stack base", () => {
    expect(stackChipCenterY(1.06, 0.06, 1)).toBeCloseTo(1.12, 8);
  });

  it("increments by chip height for each additional chip", () => {
    expect(stackChipCenterY(1.06, 0.06, 2)).toBeCloseTo(1.18, 8);
    expect(stackChipCenterY(1.06, 0.06, 3)).toBeCloseTo(1.24, 8);
  });

  it("supports arbitrary base and height values", () => {
    expect(stackChipCenterY(2.5, 0.1, 4)).toBeCloseTo(2.9, 8);
  });
});