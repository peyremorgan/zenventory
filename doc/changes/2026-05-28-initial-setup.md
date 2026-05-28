# 2026-05-28: Initial Setup and Hello-World Gameplay Prototype

## Implementation Choices

### Tech Stack Selection

**Three.js over Babylon.js and PlayCanvas**
- **Bundle size**: Three.js ships at 177 KB gzipped vs. Babylon.js at 1.7 MB — critical for browser games where first load is make-or-break
- **First-person controls**: Three.js provides purpose-built `PointerLockControls` addon, designed specifically for FPS-style camera control
- **Raycasting API**: Three.js's `Raycaster` class is straightforward and well-documented for picking/interaction
- **Community size**: 113k GitHub stars vs. 25.6k (Babylon.js) and 15.9k (PlayCanvas) — larger ecosystem means better troubleshooting resources

**Trade-off**: No built-in GUI system (unlike Babylon.js). Chose to use plain HTML/CSS overlay for HUD rather than add another dependency. This keeps bundle small and makes UI styling trivial with familiar tools.

### Build Tooling

**Vite 8 + TypeScript 6 + npm**
- Vite offers best-in-class HMR and native ESM support with zero config for Three.js
- TypeScript strict mode catches type errors at compile time
- Initially planned for pnpm but environment only had npm available — made no functional difference

**Test Infrastructure**
- **Vitest** for unit tests: runs in jsdom environment, fast feedback, built-in coverage
- **Playwright** for e2e: validates actual browser rendering and interaction flow
- Separate configs allow independent execution

### Architecture Patterns

**Pure state management in `sorting.ts`**
- Kept sorting logic (pick/place/validation) completely separate from Three.js rendering
- Functions are pure: `SortItem → SortItem` transformations
- Makes unit testing trivial — no WebGL mocking required
- Future-proof: logic can scale to hundreds of items without touching 3D code

**Module separation**
- `scene.ts`: declarative 3D geometry setup
- `player.ts`: input handling and camera movement (no game state)
- `main.ts`: orchestration only — wires modules together
- `hud.ts`: minimal DOM controller with single responsibility

**Test API exposure**
- Added `window.__zenventoryTestApi` for e2e tests to trigger interactions programmatically
- Wrapped in `typeof window !== "undefined"` guard so it's tree-shaken in production
- Alternative would be headless WebGL testing (Puppeteer GPU flags) but this was simpler

## Issues Encountered

### 1. ESLint Flat Config Migration Pain

**Problem**: ESLint 10+ uses flat config format, but many guides still reference old `.eslintrc.json` patterns.

**Symptom**: 
```
Cannot use import statement outside a module
```

**Root cause**: Initially had duplicate `"type": "commonjs"` entry in package.json that overrode `"type": "module"`.

**Solution**: 
1. Removed duplicate type field
2. Installed missing `@eslint/js` package
3. Added `globals` package and configured browser/node environments
4. Disabled `no-undef` rule since TypeScript handles this better

**Lesson**: Always verify package.json doesn't have conflicting entries after merges.

### 2. Three.js API Breaking Change

**Problem**: TypeScript compilation failed on `controls.getObject()`.

**Error**:
```
Property 'getObject' does not exist on type 'PointerLockControls'. 
Did you mean 'object'?
```

**Root cause**: Newer versions of Three.js types (0.184.x) changed PointerLockControls to directly expose `.object` instead of `.getObject()` method.

**Solution**: Replaced all `controls.getObject()` calls with `controls.object`.

**Lesson**: Three.js is still evolving rapidly — always check type definitions match runtime expectations.

### 3. Playwright Browser Installation

**Problem**: E2E tests failed with "Executable doesn't exist" error.

**Symptom**:
```
Executable doesn't exist at ~/.cache/ms-playwright/chromium_headless_shell-1223/
```

**Root cause**: Playwright was installed but browser binaries weren't downloaded.

**Solution**: User ran `npx playwright install --with-deps chromium` with sudo privileges.

**Lesson**: Playwright's `install` command is separate from `npm install @playwright/test`. Document this in setup instructions or add to `postinstall` script (though sudo requirement complicates automation).

### 4. Missing Type Dependencies

**Problem**: TypeScript compilation failed with "Cannot find type definition file for 'node'".

**Root cause**: `tsconfig.json` referenced `"types": ["node"]` but `@types/node` wasn't installed.

**Solution**: Added `@types/node` to devDependencies.

**Lesson**: TypeScript won't auto-install type packages — explicitly declare all `@types/*` dependencies.

## Lessons Learned

### Raycasting from Screen Center

For first-person interaction, raycasting from screen center (not mouse position) feels more natural:

```typescript
const screenCenter = new Vector2(0, 0); // normalized device coordinates
raycaster.setFromCamera(screenCenter, camera);
```

This creates an FPS-style "crosshair" interaction model where players aim with camera movement, not cursor.

### Pointer Lock Lifecycle

Pointer lock requires user gesture (click) to activate:

```typescript
clickTarget.addEventListener("click", () => {
  if (!controls.isLocked) {
    controls.lock();
  }
});
```

**Critical**: Don't try to auto-lock on page load — browsers block this for security. Always check `controls.isLocked` before movement logic to avoid errors when user hasn't clicked yet.

### Material Swapping for Visual Feedback

Changing an object's visual state is cleaner with material swap than color mutation:

```typescript
const messyMat = new MeshStandardMaterial({ color: "#3d2f26" });
const tidiedMat = new MeshStandardMaterial({ color: "#f4e6c8" });

// On state change:
mesh.material = item.isPlaced ? tidiedMat : messyMat;
```

This preserves material properties (roughness, metalness) and allows for texture swaps later without refactoring.

### Delta Time for Frame-Rate Independence

Movement must use delta time to stay consistent across varying frame rates:

```typescript
const delta = clock.getDelta();
const distance = speed * delta;
```

Without this, movement speed would vary wildly between 30fps and 144fps displays.

## Notes for the Future

### Architecture Debt & Extension Points

**Collision Detection Not Implemented**
- Current movement has no collision bounds — players can walk through walls
- When adding: consider using simple AABB checks first (cheaper than physics engine for basic rooms)
- Three.js Box3 helpers make this straightforward: `new Box3().setFromObject(wall)`

**Single Item Limitation**
- Current prototype hard-codes one item and one shelf
- To scale:
  1. Convert `item` from object to `Map<string, SortItem>` 
  2. Track `heldItemId: string | null` in game state
  3. Raycaster should check against all item meshes
  4. Consider octree spatial indexing if item count exceeds ~100

**Material Management**
- Currently creates two materials for one object (messy/tidy)
- With many items, this duplicates materials unnecessarily
- Solution: Create material palette once, reuse across objects:
  ```typescript
  const materials = {
    alchemy: { messy: ..., tidy: ... },
    history: { messy: ..., tidy: ... }
  };
  ```

**Test API in Production Bundle**
- `window.__zenventoryTestApi` is conditionally added but not tree-shaken in production
- Add explicit `process.env.NODE_ENV === 'test'` guard or remove before launch
- Alternative: Use Playwright's `page.exposeFunction()` to inject test helpers without polluting window

### Performance Considerations

**Bundle Size Warning**
- Vite warns about 516 KB minified chunk (Three.js core + addons)
- Consider dynamic imports for lazy-loaded features:
  ```typescript
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  ```
- Current size is acceptable for prototype but monitor as features grow

**Raycasting Every Frame**
- Current implementation raycasts on click only (good)
- If implementing hover effects, throttle raycast to every 3-5 frames to avoid CPU waste

### Missing Features for Full Game

1. **Audio**: No footsteps, pickup/place sounds, ambient audio
   - Recommendation: [Howler.js](https://howlerjs.com/) for spatial audio
   - Three.js PositionalAudio works but Howler has better mobile support

2. **Asset Loading**: No GLTF models, textures, or asset pipeline
   - Three.js GLTFLoader is standard
   - Consider Draco compression for mesh optimization
   - Implement loading screen with progress bar (user expectation for 3D games)

3. **Save State**: Progress resets on page reload
   - Use localStorage for client-side persistence
   - Structure: `{ placed: Set<itemId>, timestamp: number }`

4. **Mobile/Touch Controls**: Currently desktop-only (WASD + pointer lock)
   - Mobile needs virtual joystick + gyroscope camera or touch-drag camera
   - Consider detecting touch support: `'ontouchstart' in window`

5. **Accessibility**: No keyboard navigation for menus, screen reader support
   - HUD uses `aria-live="polite"` (good start)
   - Need focus management for any modal overlays

### Tooling Improvements

**Recommended Scripts to Add**
```json
{
  "scripts": {
    "dev:host": "vite --host 0.0.0.0",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage --reporter=html",
    "preview:build": "npm run build && npm run preview"
  }
}
```

**Git Hooks (Husky)**
- Pre-commit: `npm run lint`
- Pre-push: `npm run test`
- Prevents broken code from entering repository

### Known Edge Cases

1. **Pointer lock exit**: Pressing ESC unlocks pointer but movement keys might stay "stuck" in down state
   - Add listener: `controls.addEventListener('unlock', () => resetKeys())`

2. **Window resize during interaction**: HUD positioned absolutely, might overlap canvas on extreme aspect ratios
   - Test on mobile portrait mode

3. **Multiple rapid clicks**: Could trigger pick/place state machine errors
   - Consider debouncing or adding "isInteracting" lock flag

4. **Browser tab backgrounding**: Animation loop continues, burning CPU
   - `document.addEventListener('visibilitychange')` to pause rendering when hidden

### Code Quality Metrics

Current test coverage (7 unit tests, 2 e2e tests):
- `hud.ts`: 100% (all paths tested)
- `sorting.ts`: 75% (uncovered: error branches for already-placed items)
- `main.ts`, `player.ts`, `scene.ts`: 0% (integration-style code, covered by e2e only)

**Target for production**: 80%+ coverage on business logic, integration tests for rendering pipelines.

---

**Next sprint priorities**:
1. Add 3-5 items per category, multiple categories, multiple shelves
2. Implement mismatch feedback (wrong shelf → visual/audio cue)
3. Add collision boundaries with gentle "push-back" instead of hard walls
4. Polish: book models (GLTF), particle effects on successful placement, ambient library music
