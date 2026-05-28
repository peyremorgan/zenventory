# Chip Geometry Positioning Fix

**Date:** 2026-05-29  
**Type:** Bug Fix  
**Commits:** 002c46f (reverted), d6392ec

## Summary

Fixed poker chip orientation and visibility issues caused by incorrect rotation and Y-positioning. Chips are now properly displayed lying flat on the table surface and in sorting columns.

## Issues Encountered

### 1. Chips Standing on Edge (Initial Bug)
- **Symptom:** Chips rendered vertically on edge instead of lying flat like poker chips
- **Location:** Spawned chips on table and placed chips in sorting columns
- **Root Cause:** Explicit 90° X-axis rotation (`rotation.x = Math.PI / 2`) applied to `CylinderGeometry`
- **Files Affected:** 
  - `src/scene.ts:144` - Initial chip spawn rotation
  - `src/main.ts:59` - Placed chip rotation

### 2. Chips Completely Invisible (During Fix)
- **Symptom:** After removing rotation, chips disappeared entirely
- **Root Cause:** Y position (`tableHeight + 0.14 = 0.94`) placed chip bottoms at `0.91`, exactly at table surface (`tableHeight + 0.11`)
- **Effect:** Z-fighting or geometry clipping made chips invisible from above

### 3. Held Chips Displayed Correctly
- **Observation:** Chips held by the player appeared with correct flat orientation
- **Reason:** Held chips copied camera quaternion (`heldMesh.quaternion.copy(camera.quaternion)`) instead of using explicit rotation
- **Insight:** This revealed the correct orientation should have no additional rotation applied

## Lessons Learned

### Three.js CylinderGeometry Defaults
- **Default Orientation:** CylinderGeometry is created with circular faces **horizontal** (in XZ plane), cylinder axis along Y
- **Implication:** For poker chips lying flat on a table, NO rotation is needed
- **Previous Assumption:** The code incorrectly assumed vertical orientation required 90° rotation to make chips horizontal

### Geometry Positioning for Visibility
- **Critical:** Objects must be positioned clearly above surfaces they rest on
- **Z-Fighting:** When geometry overlaps exactly, rendering artifacts occur
- **Solution:** Elevate objects by a small offset (we used `0.08` units above table surface)
- **Calculation:**
  ```typescript
  const tableSurfaceY = tableHeight + 0.11;  // 0.91
  chipMesh.position.y = tableSurfaceY + 0.08;  // 0.99
  // Chip bottom: 0.99 - 0.03 = 0.96 (above table at 0.91) ✓
  ```

### Debugging 3D Orientation Issues
1. **Compare Working vs Broken:** Held chips (working) vs spawned chips (broken) revealed the rotation was the issue
2. **Visual Testing:** Browser screenshots crucial for 3D geometry debugging (automated tests can't catch rendering issues)
3. **Coordinate System:** Three.js uses Y-up coordinate system; cylinder height extends along Y-axis by default

## Notes for the Future

### CylinderGeometry Usage Pattern
When creating flat disc objects (coins, chips, buttons):
```typescript
// CORRECT - No rotation needed
const chip = new Mesh(
  new CylinderGeometry(radius, radius, height, segments),
  material
);
chip.position.y = surfaceY + smallOffset; // Elevate above surface
// No rotation.x, rotation.y, or rotation.z needed!

// INCORRECT - Don't do this
chip.rotation.x = Math.PI / 2; // Makes cylinder stand on edge
```

### Placement Position Consistency
- **Spawned chips** and **placed chips** should use same rotation logic
- Current implementation: Both use `rotation.set(0, 0, 0)` ✓
- **Exception:** Held chips copy camera orientation for natural feel

### Y-Position Constants to Monitor
- `tableHeight = 0.8` - Table center Y position
- `tableSurfaceY = 0.91` - Top surface of table (`tableHeight + 0.11`)
- `chip spawn Y = 0.99` - Chips elevated 0.08 above table surface
- `columnStackBaseY = 1.06` - Base Y for first chip in sorting column (`tableHeight + 0.26`)

### Potential Future Issues

#### Raycasting Sensitivity
- Chips are thin (height = 0.06), so raycasting from above has small target
- If interaction becomes difficult, consider:
  - Increasing `CylinderGeometry` height slightly (e.g., 0.08 or 0.10)
  - Adding invisible collision geometry with larger vertical extent
  - Adjusting raycaster threshold

#### Stacking in Columns
- Chips stack using `chipHeight = 0.06` increments
- If chips appear to overlap when stacked, verify:
  - `room.chipHeight` matches `CylinderGeometry` height parameter
  - Column base Y (`columnStackBaseY`) positions first chip correctly
  - Stack calculation: `baseY + (stackIndex) * chipHeight`

#### Rotation State Management
- Main rendering states: spawned (no rotation), placed (no rotation), held (camera quaternion)
- If adding new chip states (e.g., "rolling", "bouncing"), maintain rotation consistency
- Test all state transitions to avoid reverting to edge orientation

### Testing Limitations
- E2E tests cannot validate 3D rendering appearance
- Visual bugs require manual browser testing
- Consider documenting expected visual states in test plan
- Screenshot comparison could be future enhancement

## Related Files
- `src/scene.ts` - Scene setup, chip spawn positioning
- `src/main.ts` - Chip interaction, placement logic, held chip updates
- `src/sorting.ts` - Pure logic (unaffected by geometry issues)
