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
  const blueColumn: CaseColumn = {
    id: "column-blue",
    columnIndex: 0,
    acceptsColor: "blue"
  };

  const redColumn: CaseColumn = {
    id: "column-red",
    columnIndex: 2,
    acceptsColor: "red"
  };

  it("allows picking chip when hand has fewer than four chips", () => {
    const chip: Chip = {
      id: "chip-blue-0",
      color: "blue",
      isHeld: false,
      isThrown: false,
      isPlaced: false,
      placedColumnIndex: null
    };

    expect(canPickChip(chip, [])).toBe(true);
  });

  it("prevents picking when hand is already full", () => {
    const chip: Chip = {
      id: "chip-blue-0",
      color: "blue",
      isHeld: false,
      isThrown: false,
      isPlaced: false,
      placedColumnIndex: null
    };

    const heldChipA: Chip = {
      id: "chip-red-0",
      color: "red",
      isHeld: true,
      isThrown: false,
      isPlaced: false,
      placedColumnIndex: null
    };
    const heldChipB: Chip = {
      id: "chip-black-0",
      color: "black",
      isHeld: true,
      isThrown: false,
      isPlaced: false,
      placedColumnIndex: null
    };
    const heldChipC: Chip = {
      id: "chip-green-0",
      color: "green",
      isHeld: true,
      isThrown: false,
      isPlaced: false,
      placedColumnIndex: null
    };
    const heldChipD: Chip = {
      id: "chip-blue-1",
      color: "blue",
      isHeld: true,
      isThrown: false,
      isPlaced: false,
      placedColumnIndex: null
    };

    expect(canPickChip(chip, [heldChipA, heldChipB, heldChipC, heldChipD])).toBe(false);
  });

  it("picking keeps already-placed chip unchanged", () => {
    const chip: Chip = {
      id: "chip-red-2",
      color: "red",
      isHeld: false,
      isThrown: false,
      isPlaced: true,
      placedColumnIndex: 2
    };

    expect(pickChip(chip, [])).toEqual(chip);
  });

  it("prevents picking chip while it is still thrown", () => {
    const chip: Chip = {
      id: "chip-green-2",
      color: "green",
      isHeld: false,
      isThrown: true,
      isPlaced: false,
      placedColumnIndex: null
    };

    expect(canPickChip(chip, [])).toBe(false);
    expect(pickChip(chip, [])).toEqual(chip);
  });

  it("allows placement only when held, top of stack, and color matches column", () => {
    const bottomChip: Chip = {
      id: "chip-black-1",
      color: "black",
      isHeld: true,
      isThrown: false,
      isPlaced: false,
      placedColumnIndex: null
    };

    const topChip: Chip = {
      id: "chip-red-1",
      color: "red",
      isHeld: true,
      isThrown: false,
      isPlaced: false,
      placedColumnIndex: null
    };

    expect(canPlaceChip(topChip, redColumn, [bottomChip, topChip])).toBe(true);
    expect(canPlaceChip(topChip, blueColumn, [bottomChip, topChip])).toBe(false);
    expect(canPlaceChip(bottomChip, blueColumn, [bottomChip, topChip])).toBe(false);
  });

  it("placing converts held chip to placed with column index", () => {
    const chip: Chip = {
      id: "chip-red-0",
      color: "red",
      isHeld: true,
      isThrown: false,
      isPlaced: false,
      placedColumnIndex: null
    };

    expect(placeChip(chip, redColumn, [chip])).toEqual({
      ...chip,
      isHeld: false,
      isThrown: false,
      isPlaced: true,
      placedColumnIndex: 2
    });
  });

  it("placing leaves chip unchanged when wrong column", () => {
    const chip: Chip = {
      id: "chip-black-0",
      color: "black",
      isHeld: false,
      isThrown: false,
      isPlaced: false,
      placedColumnIndex: null
    };

    expect(placeChip(chip, blueColumn, [chip])).toEqual(chip);
  });

  it("progress label follows expected format", () => {
    expect(progressLabel(0, 16)).toBe("0 / 16 sorted");
    expect(progressLabel(8, 16)).toBe("8 / 16 sorted");
    expect(progressLabel(16, 16)).toBe("16 / 16 sorted");
  });
});
