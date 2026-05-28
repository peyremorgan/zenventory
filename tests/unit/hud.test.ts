import { describe, expect, it } from "vitest";
import { createHud } from "../../src/hud";

describe("HUD controller", () => {
  it("updates HUD text for progress", () => {
    document.body.innerHTML = '<div id="hud"></div>';
    const hud = createHud(1);

    hud.update(0);
    expect(document.getElementById("hud")?.textContent).toBe("0 / 1 sorted");

    hud.update(1);
    expect(document.getElementById("hud")?.textContent).toBe("1 / 1 sorted");
  });

  it("throws when HUD element is missing", () => {
    document.body.innerHTML = "";

    expect(() => createHud(1)).toThrowError("Missing #hud element in DOM.");
  });
});
