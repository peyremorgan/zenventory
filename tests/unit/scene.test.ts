import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { scaleFactorForTargetHeight, scaleFactorForTargetSpan } from "../../src/scene";

type Rgb = [number, number, number];

function parseTableDiffuseColors(mtlContent: string): Record<string, Rgb> {
  const kdByMaterial: Record<string, Rgb> = {};
  const lines = mtlContent.split(/\r?\n/);
  let currentMaterial = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("newmtl ")) {
      currentMaterial = line.slice("newmtl ".length).trim();
      continue;
    }

    if (!currentMaterial || !line.startsWith("Kd ")) {
      continue;
    }

    const components = line
      .slice("Kd ".length)
      .trim()
      .split(/\s+/)
      .map((value) => Number.parseFloat(value));

    if (components.length === 3 && components.every((value) => Number.isFinite(value))) {
      kdByMaterial[currentMaterial] = [components[0] as number, components[1] as number, components[2] as number];
    }
  }

  return kdByMaterial;
}

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

describe("table MTL palette", () => {
  it("defines diffuse colors for cloth, cushion, and wood", () => {
    const mtl = readFileSync("assets/models/table.mtl", "utf8");
    const kdByMaterial = parseTableDiffuseColors(mtl);

    expect(kdByMaterial.cloth).toBeDefined();
    expect(kdByMaterial.cushion).toBeDefined();
    expect(kdByMaterial.wood).toBeDefined();
  });

  it("uses distinct color profiles matching poker table references", () => {
    const mtl = readFileSync("assets/models/table.mtl", "utf8");
    const kdByMaterial = parseTableDiffuseColors(mtl);
    const cloth = kdByMaterial.cloth;
    const cushion = kdByMaterial.cushion;
    const wood = kdByMaterial.wood;

    if (!cloth || !cushion || !wood) {
      throw new Error("Missing table material colors in table.mtl");
    }

    expect(cloth[1]).toBeGreaterThan(cloth[0]);
    expect(cloth[1]).toBeGreaterThan(cloth[2]);

    expect(cushion[0]).toBeGreaterThan(cushion[1]);
    expect(cushion[1]).toBeGreaterThan(cushion[2]);

    expect(wood[0]).toBeGreaterThan(wood[1]);
    expect(wood[1]).toBeGreaterThan(wood[2]);

    expect(cloth[1]).toBeGreaterThan(wood[1]);
    expect(cushion[0]).toBeGreaterThan(wood[0]);
  });
});
