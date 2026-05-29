import { describe, expect, it } from "vitest";
import { scaleFactorForTargetHeight, scaleFactorForTargetSpan } from "../../src/scene";

describe("scaleFactorForTargetHeight", () => {
  it("computes a uniform scale from measured and target heights", () => {
    expect(scaleFactorForTargetHeight(2, 0.5)).toBeCloseTo(0.25, 8);
  });

  it("throws for non-positive measured heights", () => {
    expect(() => scaleFactorForTargetHeight(0, 0.06)).toThrowError("Invalid measured chip height: 0");
    expect(() => scaleFactorForTargetHeight(-2, 0.06)).toThrowError(
      "Invalid measured chip height: -2"
    );
  });

  it("throws for non-positive target heights", () => {
    expect(() => scaleFactorForTargetHeight(1, 0)).toThrowError("Invalid target chip height: 0");
    expect(() => scaleFactorForTargetHeight(1, -0.06)).toThrowError(
      "Invalid target chip height: -0.06"
    );
  });
});

describe("scaleFactorForTargetSpan", () => {
  it("computes a uniform scale from measured and target horizontal spans", () => {
    expect(scaleFactorForTargetSpan(3.1, 5.8)).toBeCloseTo(1.8709677419, 8);
  });

  it("throws for non-positive measured span", () => {
    expect(() => scaleFactorForTargetSpan(0, 5.8)).toThrowError("Invalid measured span: 0");
    expect(() => scaleFactorForTargetSpan(-1, 5.8)).toThrowError("Invalid measured span: -1");
  });

  it("throws for non-positive target span", () => {
    expect(() => scaleFactorForTargetSpan(3.1, 0)).toThrowError("Invalid target span: 0");
    expect(() => scaleFactorForTargetSpan(3.1, -1)).toThrowError("Invalid target span: -1");
  });
});
