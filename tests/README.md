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
`BoardController` also verifies synchronous click processing, ordered removal
steps, and ignoring invalid turns. `BoardModel` verifies that removal preserves
cell indices and the original array.
`BoardEngine` tests cover connected color groups, row boundaries, diagonals,
empty cells, invalid indices, reading current model data without changing it,
reusing the visited buffer, synchronous turn results, and removing matched cells.
Removal scenarios also run against the real `BoardModel`: solitary tiles and invalid
clicks leave it unchanged; only the connected group is removed; empty cells split
groups; repeated clicks preserve other cells; a second removal uses original indices;
and a uniform 8 by 8 board is completely cleared without duplicate indices.
Model tests include empty removal lists, duplicate indices, and repeated removal.

Refill has one `todo` specification: every empty cell must receive an integer color
index in `[0, colorCount)`. Refill is not implemented yet, so this is not a passing
coverage check. Gravity and the complete turn are outside the current test scope.

Rendering in `BoardView` requires the Cocos runtime and is not covered by this Node.js suite.
