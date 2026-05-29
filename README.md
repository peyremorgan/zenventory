# Zenventory

A first-person browser-based sorting game prototype inspired by cozy simulation games like Powerwash Simulator and Librarian. Built with Three.js, TypeScript, and Vite.

## Prerequisites

- Node.js 18+ (for running the development server and build tools)
- npm (comes with Node.js)

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

For end-to-end tests, you'll also need to install Playwright browsers:

```bash
npx playwright install --with-deps chromium
```

## Development

Start the development server with hot module replacement:

```bash
npm run dev
```

This will start a local server at `http://localhost:5173`. The page will automatically reload when you make changes to the source code.

### Controls

- **Click** the canvas to lock the cursor and enter first-person mode
- **WASD** to move around the room
- **Mouse** to look around
- **Click** on an item to pick it up
- **Click** on a shelf to place the item

## Testing

### Run All Tests

Run the complete test suite (linting, unit tests, and e2e tests):

```bash
npm run check
```

### Unit Tests

Run unit tests with coverage:

```bash
npm run test
```

Run unit tests in watch mode during development:

```bash
npm run test:watch
```

### End-to-End Tests

Run Playwright e2e tests (requires build):

```bash
npm run test:e2e
```

### Linting

Check code quality with ESLint:

```bash
npm run lint
```

## Building

Build the project for production:

```bash
npm run build
```

This runs TypeScript type checking followed by a Vite production build. The output will be in the `dist/` directory.

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

This serves the built files from `dist/` at `http://localhost:4173`.

## Project Structure

```
zenventory/
├── src/
│   ├── main.ts          # Application entry point and render loop
│   ├── scene.ts         # 3D scene setup (room, objects, lighting)
│   ├── player.ts        # First-person controls (WASD + pointer lock)
│   ├── sorting.ts       # Sorting game logic (pick/place/progress)
│   └── hud.ts           # HUD controller
├── tests/
│   ├── unit/            # Unit tests (Vitest)
│   └── e2e/             # End-to-end tests (Playwright)
├── index.html           # Main HTML entry point
├── vite.config.ts       # Vite configuration
├── vitest.config.ts     # Vitest configuration
├── playwright.config.ts # Playwright configuration
└── tsconfig.json        # TypeScript configuration
```

## Tech Stack

- **Three.js** - 3D rendering and WebGL
- **TypeScript** - Type-safe development
- **Vite** - Build tool and dev server
- **Vitest** - Unit testing framework
- **Playwright** - End-to-end testing
- **ESLint** - Code quality and linting

## License

MIT-0
