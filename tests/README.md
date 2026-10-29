# Tests

Tests use Node.js's built-in test runner and TypeScript type stripping; there are no third-party test dependencies.

`BombExplosionPool.test.mjs` checks both local pools' prewarming, exhaustion,
node/component/color reuse, particle lifetime, independent return and cleanup. Run it with
`node --test tests/BombExplosionPool.test.mjs` (Node.js 22.18+, no extra dependencies).
The pool owns both TileExplosion and BombExplosion. Add its node to the scene
manually and assign the component to GameBootstrap.explosionPool. BoardTileRenderer
calls play(prefab, x, y, color) and waits for isPlaying; it does not instantiate
or destroy the pool container. Tile.defaultDestructionParticles supplies the normal
effect; strategy destructionParticles overrides it and resets on pooled tile reuse.
Cleanup checks cover Cocos destroying child components before the pool component,
nodes already queued for destruction and repeated cleanup.

`TiledParticleTexture.test.mjs` checks random 2x2 cell selection, stable UVs after
particle compaction, reselection on pooled reuse, rotated atlas frames and the
TileExplosion prefab's untrimmed particle sheet. Four UV sets are cached per
component and reused across pooling. Tests check that particle updates do not
read source UVs or recalculate cells, while texture changes refresh the same cache.
The component adapts the Cocos
Creator 2.4 web particle simulator; native JSB particles use a different renderer.

`GameConfig.particleColors` supplies five RGB particle tints in the same order as
`GameBootstrap.colorSprites`: blue, green, purple, red, yellow. `BoardView.test.mjs`
checks sprite-based tint selection, unchanged prefab start alpha, opaque end color, reuse of
particle/color objects, selection tint isolation and prefab colors for special
sprites outside that palette. Tinting happens when the explosion starts.

`Scoring.test.ts` runs the actual board engine, boosters, input controller, game
model, session and GameView with a label stub. It covers configurable
points per removed cell, cumulative scoring, super tile creation and overlapping
chains, bomb effects, invalid clicks, teleport selection/cancellation/swaps, and
the scene's HUD reference. Accepted actions update GameModel immediately, since BoardModel is already changed.
Score and moves reach the HUD after awaiting the complete turn pipeline. Further clicks are ignored until it finishes, so the engine cannot
overwrite its reusable TurnResult during an awaited animation.
Run these checks independently with `node --test tests/Scoring.test.ts tests/GameModel.test.mjs`.
`GameModel.test.mjs` also checks numeric configuration, scoring, free booster actions,
win priority on the last move and immutable terminal results. GameModel owns the
level rules; GameController coordinates it with the existing GameSession FSM.
Scoring integration also covers win/loss popups, terminal input locking, cancelled
animation waits, teardown during a turn, and errors without rollback.

`Boosters.test.ts` covers bomb squares and edge clipping, chained super tiles,
atomic validation and deduplication of external removal, teleporting distant and
special tiles, cancelling and switching selection, stock consumption and reset,
the shared falling input lock, rejected effects, and a third injected strategy.
`BoostersView.test.mjs` checks button subscription cleanup, stock display, controller
wiring, prefab component UUIDs and serialized scene references.
`BoardView.test.mjs` also verifies teleport node identity, positions, input rebinding
and selection tint cleanup before pooling and on destruction.
Draw order follows cell indices from the bottom row upward, including vertical
teleports, falling and pooled reuse. Merging tiles and particles render above
the ordinary board tiles.

Booster definitions are registered as prefab assets by `BoosterFactory`; each
booster prefab contains exactly one `BoosterConfig` and one `BoosterEffectStrategy`
component and no Sprite renderer. Implement a strategy component, create its prefab,
and append that prefab to `GameBootstrap.boosterPrefabs` to extend the system.
`BoosterConfig` carries its initial stock and icon; effect-specific settings such as
bomb radius belong on the strategy component. `BoostersView` supplies the separate
reusable button prefab and creates additional buttons from registered prefabs.
Stock resets at level initialization, successful effects consume one charge and
do not spend a move. Buttons and board input share the falling lock.
BoostersView receives only a button listener and does not own the controller's
lifetime. Each BoosterButton removes its own subscriptions on destruction;
the booster controller has no external resources requiring disposal.
The teleport icon is configured in its definition prefab. Button initialization
applies definition icons over serialized scene sprites; tests verify that override.
Result popup wiring is checked through distinct nodes and label references rather
than node names. Verify final artwork and interaction in Cocos Preview.

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
`BoardController` tests call `processClick` and then await `applyTurnResult`, matching the
separate calculation and rendering phases. Booster input and level reset run through
`GameController`. These checks verify synchronous turn calculation, removal
followed by awaited animations, refill and combined falling (including an empty
movement list), and ignoring invalid turns. `BoardModel` verifies that removal preserves
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
ignored during falling and enabling input uses the current cell index. Deactivated
tiles ignore clicks and keep one subscription across pooling and cell changes;
only disposal removes the service's subscriptions, preserving external listeners.

Refill is integrated in `BoardController`: successful turns wait for removal/merge
and particles, fill all empty cells, then start one combined fall. Tests cover full-board
refill, no existing moves, invalid turns, and reusing the spawn-index buffer.
`SpawnService` returns the number of generated cells and optionally writes their
indices in ascending order to a caller-owned buffer; only that prefix is valid.

`BoardView.test.mjs` runs BoardView together with BoardTileRenderer using Cocos stubs. Node's
built-in type stripping removes TypeScript, and Inspector decorator lines are
removed before loading the component. Tests cover simultaneous falls, per-column
spawn stacks, pooled tiles, creating distinct new tiles when the pool is empty,
final cell bindings, landing bounces, input locking,
layout changes and destruction. Removal checks cover the delayed particle start,
shrinking and fading before returning a tile to its pool, warmed particle reuse,
the lifetime of particles, and input remaining locked until all animations finish.
Pipeline integration tests run the actual BoardController with BoardView and
BoardTileRenderer: merge/removal and particles finish before any falling starts,
the returned Promise resolves after the last landing bounce, and destroying the
renderer cancels either phase without starting further work. Merge keeps tile scale.
Pooling checks that require a released tile explicitly finish its removal first.
This checks numeric animation behaviour, not
actual rendering; visual validation still requires Cocos Preview.
BoardView calculates geometry and applies layout to BoardTileRenderer. BoardController
uses BoardTileRenderer directly through IBoardView; booster selection also goes directly
to BoardTileRenderer. The renderer owns tile creation, pooling, input bindings, and
the animation update. Tests run both components in frame order and verify that
BoardView does not advance animations itself.
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
The scene thresholds are 5/5/7/13. Tests cover reference identity, chains, effect areas,
no strategy prefab instantiation or extra pools, and common-pool sprite reset after reuse.

`GameSession.test.mjs` checks preparation, legal turn transitions, terminal states,
restart, pause without repeated state entry, completion during pause, session
isolation, and transitions requested from lifecycle notifications. It uses the
existing module loader and Node.js test runner without additional dependencies.
Run it with `node --test tests/GameSession.test.mjs`.
