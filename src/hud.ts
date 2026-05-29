import { progressLabel } from "./sorting";

export interface HudController {
  update: (placed: number) => void;
  updateHeldCount: (heldCount: number) => void;
}

export function createHud(total: number): HudController {
  const hudElement = document.getElementById("hud");
  const crosshairElement = document.getElementById("crosshair");

  if (!hudElement) {
    throw new Error("Missing #hud element in DOM.");
  }
  if (!crosshairElement) {
    throw new Error("Missing #crosshair element in DOM.");
  }
  const crosshair = crosshairElement;

  const baseCrosshairSize = 8;
  const crosshairExpansion = 6;

  function setCrosshairSize(heldCount: number): void {
    const randomizationScale = Math.min(3, Math.max(0, Math.floor(heldCount) - 1));
    const size = baseCrosshairSize + (crosshairExpansion * randomizationScale) / 3;
    crosshair.style.width = `${size}px`;
    crosshair.style.height = `${size}px`;
  }

  return {
    update(placed: number): void {
      hudElement.textContent = progressLabel(placed, total);
    },
    updateHeldCount(heldCount: number): void {
      setCrosshairSize(heldCount);
    }
  };
}
