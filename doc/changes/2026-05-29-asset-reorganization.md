# Asset Reorganization and Optimization

**Date**: 2026-05-29

## Summary

Reorganized and optimized 3D model assets, moving from `poker_pack/` to a more standard `assets/models/` directory structure. Significantly reduced asset count and improved loading performance by using a single chip geometry for all chip colors.

## Changes

### Asset Reorganization
- Created new `assets/models/` directory with standard naming convention
- Moved only essential models to the new directory:
  - `chip.obj` and `chip.mtl` (single chip model for all colors)
  - `table.obj` and `table.mtl` (table model)
- Removed `poker_pack/` directory and all unused assets

### Optimization
- **Single Chip Geometry**: All chip OBJ files (`chip_1.obj` through `chip_10000.obj`) contained identical geometry with only material references differing
- Implemented shared geometry approach:
  - Load chip model once
  - Reuse the same geometry for all chip colors
  - Apply color-specific materials at runtime
- Reduced from 12 chip model files (4 used + 8 unused) to 1 chip model
- Performance improvement: Only one OBJ file load + parse instead of four

### Code Changes
- Updated `scene.ts`:
  - Changed imports from individual chip models to single chip asset
  - Removed `CHIP_ASSET_BY_COLOR` mapping (no longer needed)
  - Added `CHIP_ASSET` constant for the shared chip model
  - Optimized `loadChipPrototypes()` to load geometry once and create color variants
  - Removed unused `loadChipPrototype()` helper function
- Normalized chip model references: `chip_1` → `chip`
- Updated material names: `c1` → `chip_material`

### Assets Removed
- Unused chip models: `chip_10`, `chip_20`, `chip_50`, `chip_500`, `chip_1000`, `chip_5000`, `chip_10000`
- Unused card model: `card.obj`, `card.mtl`
- All preview images and Blender source files
- About and licensing text (CC0 license retained in repository knowledge)

### Testing
- All existing unit tests pass (24/24)
- All e2e tests pass (3/3)
- No test changes required (asset loading abstraction maintained)
- Verified visual consistency in browser

## Impact

- **Repository Size**: Reduced asset footprint from ~56 files to 4 files
- **Loading Performance**: Faster initial load (single OBJ parse vs. multiple)
- **Memory Efficiency**: Shared geometry reduces runtime memory usage
- **Maintainability**: Clearer asset structure with standard naming conventions
- **No Breaking Changes**: Fallback to procedural geometry still works if assets fail to load
