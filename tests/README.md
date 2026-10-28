# Tests

Tests use Node.js's built-in test runner and TypeScript type stripping; there are no third-party test dependencies.

`Boosters.test.ts` covers bomb squares and edge clipping, chained super tiles,
atomic validation and deduplication of external removal, teleporting distant and
special tiles, cancelling and switching selection, stock consumption and reset,
the shared falling input lock, rejected effects, and a third injected strategy.
`BoostersView.test.mjs` checks button subscription cleanup, stock display, controller
wiring, prefab component UUIDs, both linked scene instances and serialized references.
`BoardView.test.mjs` also verifies teleport node identity, positions, input rebinding
and selection tint cleanup before pooling and on destruction.

Booster definitions are registered by `BoosterFactory`. Implement
`IBoosterEffectStrategy`, add a definition and a matching instance of the common
`BoosterButton` prefab to extend the system. `BoostersView.buttons` follows definition
order. Initial counts and bomb radius are configured in `GameBootstrap.config`.
Stock resets at level initialization, successful effects consume one charge and
do not spend a move. Buttons and board input share the falling lock.
The teleport button's `Icon` sprite frame is intentionally unassigned pending the
user-supplied artwork. Verify final artwork and interaction in Cocos Preview.

Known baseline issue: `SuperTileFactory.test.mjs` hard-codes a board super tile
threshold of 10; the current locally edited prefab has 13. Booster work does not
change that balancing value or the pre-existing assertion.

Requirements: Node.js 22.18 or newer.

Run the suite from the project root with:

```sh
npm test
```

Board tests are named `*.test.ts` and run directly through Node.js type stripping.
The `tests` directory is excluded from the Cocos TypeScript configuration because
these files use Node.js APIs and are not game assets.

The suite covers `GameModel`, the initial state and instance isolation of
`BoardModel`, and `BoardController` initialization order: model initialization,
color generation through `SpawnService`, and forwarding the generated cells to the view.
`SpawnService.test.ts` verifies filling empty cells, preserving existing colors and
indices, both palette boundaries, repeated calls, and an empty board.
`BoardController` also verifies synchronous click processing, refill followed by removal and
combined falling (including an empty movement list), and ignoring invalid turns. `BoardModel` verifies that removal preserves
cell indices and the original array.
`BoardEngine` tests cover connected color groups, row boundaries, diagonals,
empty cells, invalid indices, reading current model data without changing it,
reusing the visited buffer, synchronous turn results, and removing matched cells.
Removal scenarios also run against the real `BoardModel`: solitary tiles and invalid
clicks leave it unchanged; only the connected group is removed; empty cells split
groups before removal; repeated clicks preserve other cells on a single-row board;
and a uniform 8 by 8 board is completely cleared without duplicate indices.
Model tests include empty removal lists, duplicate indices, and repeated removal.

`BoardGravity.test.ts` covers falling towards row zero, stable column order,
independent columns, multiple holes, color zero, empty columns, clicks after falling,
and applying removed indices followed by moves to obtain the final model state.
Moves are an ordinary array with fixed capacity. Its objects are allocated once,
then updated by index; only the first `moveCount` entries belong to the current
click. Tests verify that the array length and object references do not change
between clicks, including invalid clicks.
Matches also use one fixed-length ordinary array and a local `matchCount`.
`findGroup` writes into a supplied preallocated array and returns the count.
Removal consumes only the first `matchCount` entries; tests verify that stale
entries from a larger previous group never remove extra cells.

`BoardInputService.test.ts` uses a small Cocos event stub to verify that clicks are
ignored during falling, enabling input uses the current cell index, and unbinding
or disposal removes only the service's subscriptions.

Refill is integrated in `BoardController`: successful turns fill all empty cells,
then remove the old tile views and start one combined fall. Tests cover full-board
refill, no existing moves, invalid turns, and reusing the spawn-index buffer.
`SpawnService` returns the number of generated cells and optionally writes their
indices in ascending order to a caller-owned buffer; only that prefix is valid.

`BoardView.test.mjs` runs BoardView together with BoardTileRenderer using Cocos stubs. Node's
built-in type stripping removes TypeScript, and Inspector decorator lines are
removed before loading the component. Tests cover simultaneous falls, per-column
spawn stacks, pooled tiles, creating distinct new tiles when the pool is empty,
final cell bindings, landing bounces, input locking,
layout changes and destruction. This checks numeric animation behaviour, not
actual rendering; visual validation still requires Cocos Preview.
BoardView calculates geometry and forwards render commands; BoardTileRenderer owns
tile creation, pooling, input bindings, and the animation update. Tests run both
components in frame order and verify that BoardView does not advance animations itself.
Fall-state tests also verify a fixed-capacity object buffer, a dense active prefix,
different completion times without skipped or double updates, and reuse of the
same objects across turns and after cancellation.


Super tile strategy prefabs contain only a root node and a SuperTileStrategy component.
The component holds minimumGroupSize, spriteFrame, and effect parameters such as radius.
The factory reads prefab data once; it never instantiates strategy prefabs or creates pools.
All tile visuals use the existing Tile prefab and one common TilePool. Transformation
changes the sprite on the existing node. Board cells contain only numbers: -1 is empty, 0..colorCount-1 are colors,
and colorCount + prefab index identifies a super tile in the shared strategy registry.

To add an effect, implement a SuperTileStrategy component, attach it to an empty prefab,
configure its threshold and sprite, and add it to GameBootstrap.superTilePrefabs.
The highest eligible threshold wins; equal thresholds are selected uniformly at random.
The scene thresholds remain 5/5/7/10. Tests cover reference identity, chains, effect areas,
no strategy prefab instantiation or extra pools, and common-pool sprite reset after reuse.
