import assert from "node:assert/strict";
import { it } from "node:test";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";
import { BoardController } from "../assets/scripts/board/BoardController.ts";
import { SpawnService } from "../assets/scripts/board/SpawnService.ts";
import { ThresholdCreationStrategy } from "../assets/scripts/superTiles/SuperTileStrategies.ts";
import { RowEffectStrategy, ColumnEffectStrategy, RadiusEffectStrategy, BoardEffectStrategy } from "./helpers/CocosComponents.mjs";

function services() {
    const effects = [new RowEffectStrategy(), new ColumnEffectStrategy(), new RadiusEffectStrategy(), new BoardEffectStrategy()];
    const thresholds = [8, 10, 12, 15];
    for (let i = 0; i < effects.length; i++) effects[i].minimumGroupSize = thresholds[i];
    return { creation: new ThresholdCreationStrategy(effects, 5), effects };
}

function board(rows: number, columns: number) {
    const model = new BoardModel(rows, columns);
    const registered = services();
    const engine = new BoardEngine(model, columns, rows * columns, registered.creation);
    model.init();
    model.getCells().fill(0);
    return { model, engine, registered };
}

it("creates exactly one super tile at every threshold and excludes it from removal", function thresholds() {
    const sizes = [7, 8, 9, 10, 11, 12, 14, 15, 20];
    const kinds = [0, 1, 1, 2, 2, 3, 3, 4, 4];
    for (let i = 0; i < sizes.length; i++) {
        const { model, engine, registered } = board(1, sizes[i]);
        const expected = kinds[i] ? 4 + kinds[i] : -1;
        const result = engine.processClick(3);
        assert.equal(result.matchCount, sizes[i]);
        assert.equal(result.transformedValue, expected);
        assert.equal(result.removedCount, sizes[i] - (kinds[i] ? 1 : 0));
        assert.equal(model.getCells()[3], expected);
        if (kinds[i]) {
            assert.equal(result.transformedIndex, 3);
            assert.ok(!result.removedIndices.slice(0, result.removedCount).includes(3));
        }
    }
});

it("moves a newly created super tile with gravity and excludes it from normal groups", function fallingSuper() {
    const { model, engine, registered } = board(4, 2);
    const result = engine.processClick(7);
    assert.equal(result.transformedIndex, 7);
    assert.equal(model.getCells()[1], 5);
    assert.equal(model.getCells()[7], -1);
    assert.deepEqual(result.moves.slice(0, result.moveCount), [{ from: 7, to: 1 }]);
    model.getCells()[0] = 0;
    assert.equal(engine.findGroup(0, new Array(8)), 0);
});

it("clips each effect to the board edges and supports configurable radius", function areas() {
    const context = { columns: 5, capacity: 25 };
    const targets = new Array<number>(25);
    assert.equal(new RowEffectStrategy().collectTargets(7, context, targets), 5);
    assert.deepEqual(targets.slice(0, 5), [5, 6, 7, 8, 9]);
    assert.equal(new ColumnEffectStrategy().collectTargets(7, context, targets), 5);
    assert.deepEqual(targets.slice(0, 5), [2, 7, 12, 17, 22]);
    assert.equal(new RadiusEffectStrategy().collectTargets(12, context, targets), 9);
    assert.equal(new RadiusEffectStrategy().collectTargets(0, context, targets), 4);
    assert.deepEqual(targets.slice(0, 4), [0, 1, 5, 6]);
    const large = new RadiusEffectStrategy();
    large.radius = 2;
    assert.equal(large.collectTargets(12, context, targets), 25);
    assert.equal(new BoardEffectStrategy().collectTargets(0, context, targets), 25);
});

it("activates overlapping chains once and never creates a super tile from effects", function chain() {
    const { model, engine } = board(5, 5);
    const registered = services();
    const calls = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        const wrapped = registered.effects[i];
        registered.effects[i] = { minimumGroupSize: wrapped.minimumGroupSize, collectTargets(origin, context, targets) {
            calls[i]++;
            return wrapped.collectTargets(origin, context, targets);
        } };
    }
    const chained = new BoardEngine(model, 5, 25, new ThresholdCreationStrategy(registered.effects, 5));
    model.transformCell(10, 5);
    model.transformCell(12, 6);
    model.transformCell(22, 7);
    model.transformCell(23, 8);
    const result = chained.processClick(10);
    assert.equal(result.matchCount, 0);
    assert.equal(result.removedCount, 25);
    assert.equal(new Set(result.removedIndices.slice(0, result.removedCount)).size, 25);
    assert.deepEqual(calls, [1, 1, 1, 1]);
    assert.equal(result.transformedIndex, -1);
    assert.equal(result.moveCount, 0);
    assert.ok(model.getCells().every(function empty(value) { return value === -1; }));
    assert.equal(engine.processClick(10).valid, false);
});

it("validates component parameters", function validation() {
    const radius = new RadiusEffectStrategy();
    radius.minimumGroupSize = 4;
    assert.strictEqual(new ThresholdCreationStrategy([radius], 5).selectTile(4), 5);
    radius.radius = 1.5;
    assert.throws(function fractional() { radius.validate(); });
    radius.minimumGroupSize = 1;
    assert.throws(function tooSmall() { new ThresholdCreationStrategy([radius], 5); });
});

it("renders transformation before falling and refills only normal cells", function controllerTurn() {
    globalThis.cc = { math: { randomRangeInt: function lowest(min: number) { return min; } } } as any;
    const { model, engine, registered } = board(4, 2);
    const calls: string[] = [];
    const controller = new BoardController(model, {
        initRender(): void {},
        removeTiles(_indices, count): void { assert.equal(count, 7); calls[calls.length] = "remove"; },
        transformTile(index, value): void { assert.equal(index, 7); assert.equal(value, 5); calls[calls.length] = "transform"; },
        fallTiles(_moves, count, _cells, _spawned, spawnCount): void {
            assert.equal(count, 1);
            assert.equal(spawnCount, 7);
            assert.deepEqual(_cells, [0, 5, 0, 0, 0, 0, 0, 0]);
            calls[calls.length] = "fall";
        }
    }, engine, new SpawnService(1));
    controller.init();
    controller.onCellClicked(7);
    assert.deepEqual(calls, ["remove", "transform", "fall"]);
});


it("selects highest eligible threshold in any order, with last-prefab priority on ties", function equalThresholds() {
    const row = new RowEffectStrategy(); row.minimumGroupSize = 5;
    const column = new ColumnEffectStrategy(); column.minimumGroupSize = 5;
    const radius = new RadiusEffectStrategy(); radius.minimumGroupSize = 7;
    const board = new BoardEffectStrategy(); board.minimumGroupSize = 10;
    const creation = new ThresholdCreationStrategy([board, row, column, radius], 5);
    assert.equal(creation.selectTile(4), -1);
    assert.strictEqual(creation.selectTile(5), 7);
    assert.strictEqual(creation.selectTile(6), 7);
    assert.strictEqual(creation.selectTile(7), 8);
    assert.strictEqual(creation.selectTile(10), 5);
});


it("assigns super tile numbers directly above the configured color range", function numericCodes() {
    const effect = new RowEffectStrategy();
    for (const colorCount of [2, 3, 5]) {
        const registry = new ThresholdCreationStrategy([effect], colorCount);
        assert.equal(registry.selectTile(8), colorCount);
        assert.strictEqual(registry.getStrategy(colorCount), effect);
        assert.equal(registry.getStrategy(colorCount - 1), null);
        const model = new BoardModel(1, 2);
        model.init();
        model.transformCell(1, colorCount);
        model.moveCell(1, 0);
        assert.deepEqual(model.getCells(), [colorCount, -1]);
    }
});
