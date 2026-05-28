export function stackChipCenterY(
  columnStackBaseY: number,
  chipHeight: number,
  stackedCount: number
): number {
  return columnStackBaseY + stackedCount * chipHeight;
}