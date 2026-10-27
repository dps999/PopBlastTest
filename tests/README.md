# Tests

Tests use Node.js's built-in test runner and TypeScript type stripping; there are no third-party test dependencies.

Requirements: Node.js 22.18 or newer.

Run the suite from the project root with:

```sh
npm test
```

Board tests are named `*.test.ts` and run directly through Node.js type stripping.
The `tests` directory is excluded from the Cocos TypeScript configuration because
these files use Node.js APIs and are not game assets.

The suite covers `GameModel`, the initial state and instance isolation of
`BoardModel`, and `BoardController` initialization order and cell forwarding.
`BoardEngine` currently has no behavior to test. Rendering in `BoardView` requires
the Cocos runtime and is not covered by this Node.js suite.
