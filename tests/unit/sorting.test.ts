import { describe, expect, it } from "vitest";
import { canPlaceItem, pickItem, placeItem, progressLabel, type ShelfZone, type SortItem } from "../../src/sorting";

describe("sorting rules", () => {
  const shelf: ShelfZone = {
    id: "shelf",
    acceptsCategory: "alchemy"
  };

  it("allows placing only when held and category matches", () => {
    const item: SortItem = {
      id: "book-1",
      category: "alchemy",
      isHeld: true,
      isPlaced: false
    };

    expect(canPlaceItem(item, shelf)).toBe(true);
  });

  it("does not allow placing when not held", () => {
    const item: SortItem = {
      id: "book-1",
      category: "alchemy",
      isHeld: false,
      isPlaced: false
    };

    expect(canPlaceItem(item, shelf)).toBe(false);
  });

  it("picking keeps already-placed item unchanged", () => {
    const item: SortItem = {
      id: "book-1",
      category: "alchemy",
      isHeld: false,
      isPlaced: true
    };

    expect(pickItem(item)).toEqual(item);
  });

  it("placing converts held unplaced item into placed and not held", () => {
    const item: SortItem = {
      id: "book-1",
      category: "alchemy",
      isHeld: true,
      isPlaced: false
    };

    expect(placeItem(item, shelf)).toEqual({
      ...item,
      isHeld: false,
      isPlaced: true
    });
  });

  it("progress label follows expected format", () => {
    expect(progressLabel(0, 1)).toBe("0 / 1 sorted");
    expect(progressLabel(1, 1)).toBe("1 / 1 sorted");
  });
});
