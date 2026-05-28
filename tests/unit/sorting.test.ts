import { describe, expect, it } from "vitest";
import {
  canPickChip,
  canPlaceChip,
  pickChip,
  placeChip,
  progressLabel,
  type CaseColumn,
  type Chip
} from "../../src/sorting";

describe("sorting rules", () => {
  const whiteColumn: CaseColumn = {
    id: "column-white",
    columnIndex: 0,
    acceptsColor: "white"
  };

  const redColumn: CaseColumn = {
    id: "column-red",
    columnIndex: 2,
    acceptsColor: "red"
  };

  it("allows picking chip only when hand is empty", () => {
    const chip: Chip = {
      id: "chip-white-0",
      color: "white",
      isHeld: false,
      isPlaced: false,
      placedColumnIndex: null
    };

    expect(canPickChip(chip, null)).toBe(true);
  });

  it("prevents picking when another chip is held", () => {
    const chip: Chip = {
      id: "chip-white-0",
      color: "white",
      isHeld: false,
      isPlaced: false,
      placedColumnIndex: null
    };
    const heldChip: Chip = {
      id: "chip-red-0",
      color: "red",
      isHeld: true,
      isPlaced: false,
      placedColumnIndex: null
    };

    expect(canPickChip(chip, heldChip)).toBe(false);
  });

  it("picking keeps already-placed chip unchanged", () => {
    const chip: Chip = {
      id: "chip-red-2",
      color: "red",
      isHeld: false,
      isPlaced: true,
      placedColumnIndex: 2
    };

    expect(pickChip(chip, null)).toEqual(chip);
  });

  it("allows placement only when held and color matches column", () => {
    const chip: Chip = {
      id: "chip-red-1",
      color: "red",
      isHeld: true,
      isPlaced: false,
      placedColumnIndex: null
    };

    expect(canPlaceChip(chip, redColumn)).toBe(true);
    expect(canPlaceChip(chip, whiteColumn)).toBe(false);
  });

  it("placing converts held chip to placed with column index", () => {
    const chip: Chip = {
      id: "chip-red-0",
      color: "red",
      isHeld: true,
      isPlaced: false,
      placedColumnIndex: null
    };

    expect(placeChip(chip, redColumn)).toEqual({
      ...chip,
      isHeld: false,
      isPlaced: true,
      placedColumnIndex: 2
    });
  });

  it("placing leaves chip unchanged when wrong column", () => {
    const chip: Chip = {
      id: "chip-black-0",
      color: "black",
      isHeld: false,
      isPlaced: false,
      placedColumnIndex: null
    };

    expect(placeChip(chip, whiteColumn)).toEqual(chip);
  });

  it("progress label follows expected format", () => {
    expect(progressLabel(0, 16)).toBe("0 / 16 sorted");
    expect(progressLabel(8, 16)).toBe("8 / 16 sorted");
    expect(progressLabel(16, 16)).toBe("16 / 16 sorted");
  });
});
