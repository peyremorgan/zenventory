import { describe, expect, it } from "vitest";
import { createHud } from "../../src/hud";

describe("HUD controller", () => {
  it("updates HUD text for progress", () => {
    document.body.innerHTML = '<div id="hud"></div><div id="crosshair"></div>';
    const hud = createHud(1);

    hud.update(0);
    expect(document.getElementById("hud")?.textContent).toBe("0 / 1 sorted");

    hud.update(1);
    expect(document.getElementById("hud")?.textContent).toBe("1 / 1 sorted");
  });

  it("expands crosshair as held chip count increases", () => {
    document.body.innerHTML = '<div id="hud"></div><div id="crosshair"></div>';
    const hud = createHud(16);
    const crosshair = document.getElementById("crosshair");
    if (!crosshair) {
      throw new Error("Missing #crosshair in test DOM");
    }

    hud.updateHeldCount(1);
    const oneChipWidth = parseFloat(crosshair.style.width);

    hud.updateHeldCount(2);
    const twoChipWidth = parseFloat(crosshair.style.width);

    hud.updateHeldCount(4);
    const fourChipWidth = parseFloat(crosshair.style.width);

    expect(oneChipWidth).toBeCloseTo(8, 6);
    expect(twoChipWidth).toBeGreaterThan(oneChipWidth);
    expect(fourChipWidth).toBeGreaterThan(twoChipWidth);
    expect(fourChipWidth).toBeCloseTo(14, 6);
  });

  it("throws when HUD element is missing", () => {
    document.body.innerHTML = "";

    expect(() => createHud(1)).toThrowError("Missing #hud element in DOM.");
  });

  it("throws when crosshair element is missing", () => {
    document.body.innerHTML = '<div id="hud"></div>';

    expect(() => createHud(1)).toThrowError("Missing #crosshair element in DOM.");
  });
});
