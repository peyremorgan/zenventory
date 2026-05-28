export type ChipColor = "white" | "black" | "red" | "green";

export interface Chip {
  id: string;
  color: ChipColor;
  isPlaced: boolean;
  isHeld: boolean;
  placedColumnIndex: number | null;
}

export interface CaseColumn {
  id: string;
  columnIndex: number;
  acceptsColor: ChipColor;
}

export function canPickChip(chip: Chip, heldChip: Chip | null): boolean {
  return !chip.isPlaced && !chip.isHeld && heldChip === null;
}

export function canPlaceChip(chip: Chip, column: CaseColumn): boolean {
  return chip.isHeld && !chip.isPlaced && chip.color === column.acceptsColor;
}

export function pickChip(chip: Chip, heldChip: Chip | null): Chip {
  if (!canPickChip(chip, heldChip)) {
    return chip;
  }

  return {
    ...chip,
    isHeld: true
  };
}

export function placeChip(chip: Chip, column: CaseColumn): Chip {
  if (!canPlaceChip(chip, column)) {
    return chip;
  }

  return {
    ...chip,
    isHeld: false,
    isPlaced: true,
    placedColumnIndex: column.columnIndex
  };
}

export function progressLabel(placed: number, total: number): string {
  return `${placed} / ${total} sorted`;
}
