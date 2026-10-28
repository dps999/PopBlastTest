import assert from "node:assert/strict";
import { it } from "node:test";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";
import { BoardController } from "../assets/scripts/board/BoardController.ts";
import { BoardInputService } from "../assets/scripts/board/BoardInputService.ts";
import { BoosterController } from "../assets/scripts/boosters/BoosterController.ts";
import { BoosterModel } from "../assets/scripts/boosters/BoosterModel.ts";
import { ThresholdCreationStrategy } from "../assets/scripts/superTiles/SuperTileStrategies.ts";
import { loadGameModule, RowEffectStrategy, ColumnEffectStrategy } from "./helpers/CocosComponents.mjs";
const { GameController } = await import(await loadGameModule("gameplay/GameController.ts"));
const { GameSession } = await import(await loadGameModule("gameplay/GameSession.ts"));
import type { BoosterContext, BoosterDefinition, IBoosterEffectStrategy } from "../assets/scripts/boosters/BoosterContracts.ts";
import type { TurnResult } from "../assets/scripts/board/IBoardEngine.ts";

const { default: BombBoosterStrategy } = await import(await loadGameModule("boosters/BombBoosterStrategy.ts"));
const { default: TeleportBoosterStrategy } = await import(await loadGameModule("boosters/TeleportBoosterStrategy.ts"));
import { GameModel } from "../assets/scripts/gameplay/GameModel.ts";
const gameView = { render(): void {}, showResult(): void {} };

function bomb(radius: number = 1) {
    const effect = new BombBoosterStrategy();
    effect.radius = radius;
    effect.validate();
    return effect;
}

function context(): BoosterContext {
    return { columns: 5, capacity: 25, targets: new Array<number>(25).fill(0) };
}

function fixture(definitions?: BoosterDefinition[]) {
    const model = new BoardModel(5, 5);
    const engine = new BoardEngine(model, 5, 25);
    const registered = definitions || [
        { effect: bomb(), initialCount: 3, icon: null },
        { effect: new TeleportBoosterStrategy(), initialCount: 3, icon: null }
    ];
    const stock = new BoosterModel(registered);
    const buttons: { count: number; active: boolean; enabled: boolean }[] = [];
    const view = {
        selected: -1, swaps: 0, falls: 0, removes: 0,
        initRender(): void {}, transformTile(): void {},
        removeTiles(): void { this.removes++; },
        swapTiles(): void { this.swaps++; },
        fallTiles(): void { this.falls++; },
        setInputLocked(_locked: boolean): void {},
        waitForAnimations(): Promise<boolean> { return Promise.resolve(true); },
        setSelectedCell(index: number): void { this.selected = index; },
        renderButton(index: number, count: number, active: boolean, enabled: boolean): void {
            buttons[index] = { count, active, enabled };
        }
    };
    const boosters = new BoosterController(registered, stock, model, engine, view, view, 5, 25);
    const spawn = {
        calls: 0,
        spawn(cells: number[], indices?: number[]): number {
            this.calls++;
            let count = 0;
            for (let i = 0; i < cells.length; i++) {
                if (cells[i] < 0) {
                    cells[i] = i % 3;
                    if (indices) indices[count] = i;
                    count++;
                }
            }
            return count;
        }
    };
    const boardController = new BoardController(model, view, engine, spawn);
    const board = new GameController(boardController, boosters, new GameModel(20, 10, 100000), new GameSession(), gameView);
    board.init();
    return { model, engine, stock, view, buttons, boosters, board, spawn };
}

it("bomb clips a square at corners and edges, supports large radii and reuses its buffer", function areas() {
    const effect = bomb();
    let previous: number[] | null = null;
    const calls: number[][] = [];
    const actions = {
        processRemoval(indices: number[], count: number): TurnResult {
            if (previous) assert.strictEqual(indices, previous);
            previous = indices;
            assert.equal(indices.length, 25);
            calls[calls.length] = indices.slice(0, count);
            return { valid: true } as TurnResult;
        },
        processSwap(): TurnResult { throw new Error("Unexpected swap"); }
    };
    const sharedContext = context();
    effect.execute([12], actions, sharedContext);
    effect.execute([0], actions, sharedContext);
    effect.execute([24], actions, sharedContext);
    effect.execute([2], actions, sharedContext);
    assert.deepEqual(calls, [[6, 7, 8, 11, 12, 13, 16, 17, 18], [0, 1, 5, 6], [18, 19, 23, 24], [1, 2, 3, 6, 7, 8]]);
    previous = null;
    bomb(9).execute([0], actions, context());
    assert.equal(calls[4].length, 25);
    assert.throws(function fractional() { bomb(1.5); });
    assert.throws(function zero() { bomb(0); });
});

it("bomb activates overlapping super tiles once without creating new ones", function chains() {
    const model = new BoardModel(5, 5); model.init(); model.getCells().fill(0);
    const row = new RowEffectStrategy(); const column = new ColumnEffectStrategy();
    let rowCalls = 0; let columnCalls = 0;
    const effects = [
        { minimumGroupSize: 2, spriteFrame: null, collectTargets(origin, context, targets) {
            rowCalls++; return row.collectTargets(origin, context, targets);
        } },
        { minimumGroupSize: 2, spriteFrame: null, collectTargets(origin, context, targets) {
            columnCalls++; return column.collectTargets(origin, context, targets);
        } }
    ];
    model.transformCell(12, 3); model.transformCell(13, 4);
    const engine = new BoardEngine(model, 5, 25, new ThresholdCreationStrategy(effects, 3));
    const result = bomb().execute([12], engine, context());
    assert.equal(result.valid, true);
    assert.equal(rowCalls, 1); assert.equal(columnCalls, 1);
    assert.equal(result.transformedIndex, -1); assert.equal(result.matchCount, 0);
    assert.equal(result.removedCount, 13);
    assert.equal(new Set(result.removedIndices.slice(0, result.removedCount)).size, 13);
});

it("external removal deduplicates seeds and rejects malformed requests atomically", function removalValidation() {
    const { engine, model } = fixture();
    const before = model.getCells().slice();
    assert.equal(engine.processRemoval([0, 25], 2).valid, false);
    assert.equal(engine.processRemoval([0], 2).valid, false);
    assert.equal(engine.processRemoval([0], 0).valid, false);
    assert.deepEqual(model.getCells(), before);
    assert.equal(engine.processRemoval([0, 0, 1], 3).removedCount, 2);
});

it("teleport selects two distant tiles, including super tiles, without refill or gravity", async function teleport(): Promise<void> {
    const { model, boosters, board, view, stock, spawn, engine } = fixture();
    const cells = model.getCells(); cells[0] = 8; cells[24] = 1;
    const before = cells.slice();
    boosters.selectBooster(1); await board.onCellClicked(0);
    assert.equal(view.selected, 0); assert.equal(stock.getCount(1), 3);
    assert.deepEqual(cells, before); assert.equal(view.falls, 0);
    await board.onCellClicked(24);
    assert.equal(cells[0], 1); assert.equal(cells[24], 8);
    assert.equal(view.swaps, 1); assert.equal(view.falls, 0); assert.equal(view.removes, 0);
    assert.equal(spawn.calls, 1); assert.equal(view.selected, -1);
    assert.equal(stock.getCount(1), 2); assert.equal(boosters.isActive(), false);
    const result = engine.processSwap(0, 24);
    const buffer = result.removedIndices; const moves = result.moves;
    assert.equal(result.removedCount, 0); assert.equal(result.moveCount, 0);
    assert.equal(result.transformedIndex, -1);
    assert.strictEqual(engine.processSwap(0, 0), result);
    assert.equal(result.valid, false); assert.equal(result.swappedFirstIndex, -1);
    assert.strictEqual(result.removedIndices, buffer); assert.strictEqual(result.moves, moves);
    assert.equal(engine.processSwap(-1, 1).valid, false);
    assert.equal(engine.processSwap(0, NaN).valid, false);
    cells[1] = -1;
    assert.equal(engine.processSwap(0, 1).valid, false);
});

it("selection can be cancelled, deselected, switched and invalid clicks never spend stock", async function selection(): Promise<void> {
    const { boosters, board, view, stock, buttons, model } = fixture();
    boosters.selectBooster(1); await board.onCellClicked(0); await board.onCellClicked(0);
    assert.equal(view.selected, -1); assert.equal(boosters.isActive(), true);
    await board.onCellClicked(1); boosters.selectBooster(1);
    assert.equal(boosters.isActive(), false); assert.equal(view.selected, -1);
    boosters.selectBooster(1); await board.onCellClicked(0); boosters.selectBooster(0);
    assert.equal(view.selected, -1); assert.equal(buttons[0].active, true); assert.equal(buttons[1].active, false);
    await board.onCellClicked(-1); await board.onCellClicked(25); await board.onCellClicked(1.1);
    assert.equal(stock.getCount(0), 3); assert.equal(stock.getCount(1), 3);
    await board.onCellClicked(12);
    assert.equal(stock.getCount(0), 2); assert.equal(view.falls, 1); assert.equal(view.removes, 1);
    assert.equal(boosters.isActive(), false);
    assert.ok(model.getCells().every(function filled(value) { return value >= 0; }));
});

it("stock reaches zero, disables the button and resets on level initialization", async function stock(): Promise<void> {
    const { boosters, board, buttons, stock } = fixture();
    for (let i = 0; i < 3; i++) { boosters.selectBooster(1); await board.onCellClicked(0); await board.onCellClicked(3); }
    assert.equal(stock.getCount(1), 0); assert.equal(buttons[1].enabled, false);
    boosters.selectBooster(1); assert.equal(boosters.isActive(), false);
    boosters.init(); assert.equal(stock.getCount(1), 3); assert.equal(buttons[1].enabled, true);
    assert.throws(function negative() { fixture([{ effect: new TeleportBoosterStrategy(), initialCount: -1, icon: null }]); });
});

it("shared input state blocks booster activation and targets during falling", async function inputLock(): Promise<void> {
    const { boosters, board, buttons, stock } = fixture();
    const input = new BoardInputService(board); input.setStateListener(board);
    boosters.selectBooster(1); await board.onCellClicked(0);
    input.setEnabled(false); assert.equal(input.isEnabled(), false);
    assert.equal(buttons[0].enabled, false); assert.equal(buttons[1].enabled, false);
    boosters.selectBooster(0); await board.onCellClicked(24);
    assert.equal(stock.getCount(1), 3); assert.equal(buttons[1].active, true);
    input.setEnabled(true); await board.onCellClicked(24);
    assert.equal(stock.getCount(1), 2); assert.equal(buttons[1].enabled, true);
    input.dispose(); boosters.dispose(); input.setEnabled(false);
    boosters.selectBooster(0); assert.equal(boosters.isActive(), false);
});

it("a third strategy plugs into selection and rendering without controller changes", async function extensibility(): Promise<void> {
    const custom: IBoosterEffectStrategy = {
        targetCount: 1,
        validate(): void {},
        canSelect(index): boolean { return index === 4; },
        execute(selected, actions): TurnResult { return actions.processRemoval(selected, 1); }
    };
    const { boosters, board, stock, buttons } = fixture([
        { effect: bomb(), initialCount: 0, icon: null },
        { effect: new TeleportBoosterStrategy(), initialCount: 0, icon: null },
        { effect: custom, initialCount: 1, icon: null }
    ]);
    assert.equal(buttons[0].enabled, false);
    boosters.selectBooster(2); await board.onCellClicked(0); assert.equal(stock.getCount(2), 1);
    await board.onCellClicked(4); assert.equal(stock.getCount(2), 0); assert.equal(buttons[2].enabled, false);
});

it("a rejected effect leaves stock unchanged and clears pending targets", async function invalidEffect(): Promise<void> {
    const custom: IBoosterEffectStrategy = {
        targetCount: 1,
        validate(): void {},
        canSelect(): boolean { return true; },
        execute(_selected, actions): TurnResult { return actions.processSwap(0, 0); }
    };
    const { boosters, board, stock, view } = fixture([{ effect: custom, initialCount: 1, icon: null }]);
    boosters.selectBooster(0); await board.onCellClicked(3);
    assert.equal(stock.getCount(0), 1); assert.equal(boosters.isActive(), true); assert.equal(view.selected, -1);
});
