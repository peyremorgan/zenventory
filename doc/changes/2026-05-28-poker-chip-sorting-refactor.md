# Poker Chip Sorting Refactor (Book/Shelf -> Table/Chips/Case)

Replaced the single-item book/shelf prototype with a full poker-chip sorting loop: 16 chips across 4 colors, one-chip carry constraint, and color-matched column placement in a chip case.

## What Changed

- Reworked gameplay state from one `alchemy` item into typed poker entities:
  - `ChipColor` union: `white | black | red | green`
  - `Chip` with held/placed state and persisted target column index
  - `CaseColumn` with accepted chip color
- Added rule helpers for explicit constraints:
  - `canPickChip` denies pick when a chip is already held
  - `canPlaceChip` only allows placement if held and color matches the target column
  - `pickChip`/`placeChip` immutable transition helpers
- Replaced scene content and layout:
  - Removed book and shelf meshes
  - Added a poker table, chip storage case base, 4 translucent color-coded columns, and 16 chip meshes (4 per color)
  - Updated hold offset and placement stack geometry so chips stack vertically per column
- Refactored interaction flow in runtime:
  - Raycast pick phase for chips when hand is empty
  - Raycast place phase for case columns when a chip is held
  - Shared placement helper to avoid duplication between runtime interaction and test API paths
  - Added defensive progress increment behavior (only increments once per newly placed chip)
- Updated UX text:
  - HUD initial state from `0 / 1 sorted` to `0 / 16 sorted`
  - Help text now describes chip + matching-column interaction
- Updated tests:
  - Unit tests now cover chip pick/place rules and edge cases
  - E2E tests now verify one-chip hold enforcement, wrong-column rejection, and correct-column acceptance

## Issues encountered

- A syntax regression in updated unit tests (`missing commas`) caused ESLint parse failure.
  - Resolution: fixed test object literals and re-ran lint.
- A TypeScript warning in runtime (`canvas is possibly null`) was triggered by a non-essential dispatch path.
  - Resolution: removed the unused event dispatch.
- Vitest CLI mismatch during an initial attempt (`--runInBand` unsupported by this setup).
  - Resolution: reverted to project-standard `npm run test` command.

## Lessons learned

- Keeping placement logic in one helper reduces drift and avoids behavior mismatches between production interaction and test hooks.
- Explicit domain types (`Chip`, `CaseColumn`, `ChipColor`) made it much easier to reason about edge conditions than extending the previous generic item/shelf model.
- Even in a simple scene, stable index alignment between generated chip meshes and chip state data is critical. The implementation works because creation order is deterministic.
- Re-running the full validation pipeline multiple times caught integration mistakes early and provided confidence before commit.

## Notes for the future

- The current implementation uses procedural primitive meshes (Cylinder/Box) for speed and reliability.
  - If moving to GLTF assets later, keep the same gameplay API contract and swap only the scene construction layer.
- Chip-to-state mapping is index-based (`chipMeshes[index] <-> chips[index]`).
  - If scene creation becomes async/model-driven, introduce an explicit ID-based lookup map to avoid desynchronization risks.
- Case-column identity currently depends on `mesh.userData.columnIndex`.
  - Preserve this contract (or centralize mapping) when changing case geometry.
- Coverage is currently concentrated in pure logic and e2e behavior paths.
  - Add focused integration tests around runtime helpers if interaction complexity grows (e.g., drag/drop, snapping, animation states).
- Build output reports a Vite chunk size warning for current bundle composition.
  - Not a correctness issue, but future optimization could introduce code-splitting if startup size becomes a product concern.
