export type ItemCategory = "alchemy";

export interface SortItem {
  id: string;
  category: ItemCategory;
  isPlaced: boolean;
  isHeld: boolean;
}

export interface ShelfZone {
  id: string;
  acceptsCategory: ItemCategory;
}

export function canPlaceItem(item: SortItem, shelf: ShelfZone): boolean {
  return item.isHeld && !item.isPlaced && item.category === shelf.acceptsCategory;
}

export function pickItem(item: SortItem): SortItem {
  if (item.isPlaced) {
    return item;
  }

  return {
    ...item,
    isHeld: true
  };
}

export function placeItem(item: SortItem, shelf: ShelfZone): SortItem {
  if (!canPlaceItem(item, shelf)) {
    return item;
  }

  return {
    ...item,
    isHeld: false,
    isPlaced: true
  };
}

export function progressLabel(placed: number, total: number): string {
  return `${placed} / ${total} sorted`;
}
