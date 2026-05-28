import { progressLabel } from "./sorting";

export interface HudController {
  update: (placed: number) => void;
}

export function createHud(total: number): HudController {
  const hudElement = document.getElementById("hud");

  if (!hudElement) {
    throw new Error("Missing #hud element in DOM.");
  }

  return {
    update(placed: number): void {
      hudElement.textContent = progressLabel(placed, total);
    }
  };
}
