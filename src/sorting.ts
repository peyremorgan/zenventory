export type ChipColor = "blue" | "black" | "red" | "green";

export interface Chip {
  id: string;
  color: ChipColor;
  isPlaced: boolean;
  isHeld: boolean;
  isThrown: boolean;
  placedColumnIndex: number | null;
}

export interface CaseColumn {
  id: string;
  columnIndex: number;
  acceptsColor: ChipColor;
}

export function canPickChip(chip: Chip, heldChips: Chip[]): boolean {
  return !chip.isPlaced && !chip.isHeld && !chip.isThrown && heldChips.length < 4;
}

export function canPlaceChip(chip: Chip, column: CaseColumn, heldChips: Chip[]): boolean {
  const topHeldChip = heldChips[heldChips.length - 1];
  return (
    chip.isHeld &&
    !chip.isPlaced &&
    chip.color === column.acceptsColor &&
    topHeldChip?.id === chip.id
  );
}

export function pickChip(chip: Chip, heldChips: Chip[]): Chip {
  if (!canPickChip(chip, heldChips)) {
    return chip;
  }

  return {
    ...chip,
    isHeld: true,
    isThrown: false
  };
}

export function placeChip(chip: Chip, column: CaseColumn, heldChips: Chip[]): Chip {
  if (!canPlaceChip(chip, column, heldChips)) {
    return chip;
  }

  return {
    ...chip,
    isHeld: false,
    isThrown: false,
    isPlaced: true,
    placedColumnIndex: column.columnIndex
  };
}

export function progressLabel(placed: number, total: number): string {
  return `${placed} / ${total} sorted`;
}
