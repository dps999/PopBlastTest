import assert from "node:assert/strict";
import { it } from "node:test";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";
import { BoardController } from "../assets/scripts/board/BoardController.ts";
import { SpawnService } from "../assets/scripts/board/SpawnService.ts";
import { TileKind, ThresholdCreationStrategy, RowEffectStrategy, ColumnEffectStrategy, RadiusEffectStrategy, BoardEffectStrategy } from "../assets/scripts/superTiles/SuperTileStrategies.ts";

function services() {
    return {
        creation: new ThresholdCreationStrategy([
            { kind: 1, minimumGroupSize: 8 }, { kind: 2, minimumGroupSize: 10 },
            { kind: 3, minimumGroupSize: 12 }, { kind: 4, minimumGroupSize: 15 }
        ]),
        effects: [undefined, new RowEffectStrategy(), new ColumnEffectStrategy(), new RadiusEffectStrategy(1), new BoardEffectStrategy()]
    };
}

function board(rows: number, columns: number) {
    const model = new BoardModel(rows, columns);
    const engine = new BoardEngine(model, columns, rows * columns, services());
    model.init();
    model.getCells().fill(0);
    return { model, engine };
}

it("creates exactly one super tile at every threshold and excludes it from removal", function thresholds() {
    const sizes = [7, 8, 9, 10, 11, 12, 14, 15, 20];
    const kinds = [0, 1, 1, 2, 2, 3, 3, 4, 4];
    for (let i = 0; i < sizes.length; i++) {
        const { model, engine } = board(1, sizes[i]);
        const result = engine.processClick(3);
        assert.equal(result.matchCount, sizes[i]);
        assert.equal(result.transformedKind, kinds[i]);
        assert.equal(result.removedCount, sizes[i] - (kinds[i] ? 1 : 0));
        assert.equal(model.getTileKinds()[3], kinds[i]);
        if (kinds[i]) {
            assert.equal(result.transformedIndex, 3);
            assert.ok(!result.removedIndices.slice(0, result.removedCount).includes(3));
        }
    }
});

it("moves a newly created super tile with gravity and excludes it from normal groups", function fallingSuper() {
    const { model, engine } = board(4, 2);
    const result = engine.processClick(7);
    assert.equal(result.transformedIndex, 7);
    assert.equal(model.getTileKinds()[1], TileKind.Row);
    assert.equal(model.getTileKinds()[7], TileKind.Normal);
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
    assert.equal(new RadiusEffectStrategy(1).collectTargets(12, context, targets), 9);
    assert.equal(new RadiusEffectStrategy(1).collectTargets(0, context, targets), 4);
    assert.deepEqual(targets.slice(0, 4), [0, 1, 5, 6]);
    assert.equal(new RadiusEffectStrategy(2).collectTargets(12, context, targets), 25);
    assert.equal(new BoardEffectStrategy().collectTargets(0, context, targets), 25);
});

it("activates overlapping chains once and never creates a super tile from effects", function chain() {
    const { model, engine } = board(5, 5);
    const registered = services();
    const calls = [0, 0, 0, 0, 0];
    for (let i = 1; i <= 4; i++) {
        const wrapped = registered.effects[i];
        registered.effects[i] = { collectTargets(origin, context, targets) {
            calls[i]++;
            return wrapped.collectTargets(origin, context, targets);
        } };
    }
    const chained = new BoardEngine(model, 5, 25, registered);
    model.transformCell(10, 1);
    model.transformCell(12, 2);
    model.transformCell(22, 3);
    model.transformCell(23, 4);
    const result = chained.processClick(10);
    assert.equal(result.matchCount, 0);
    assert.equal(result.removedCount, 25);
    assert.equal(new Set(result.removedIndices.slice(0, result.removedCount)).size, 25);
    assert.deepEqual(calls, [0, 1, 1, 1, 1]);
    assert.equal(result.transformedIndex, -1);
    assert.equal(result.moveCount, 0);
    assert.ok(model.getCells().every(function empty(value) { return value === -1; }));
    assert.ok(model.getTileKinds().every(function normal(value) { return value === 0; }));
    assert.equal(engine.processClick(10).valid, false);
});

it("accepts custom thresholds and rejects ambiguous config", function validation() {
    assert.equal(new ThresholdCreationStrategy([{ kind: 3, minimumGroupSize: 4 }]).selectKind(4), 3);
    assert.throws(function duplicate() { new ThresholdCreationStrategy([{ kind: 1, minimumGroupSize: 8 }, { kind: 1, minimumGroupSize: 10 }]); });
    assert.throws(function unordered() { new ThresholdCreationStrategy([{ kind: 1, minimumGroupSize: 8 }, { kind: 2, minimumGroupSize: 7 }]); });
    assert.throws(function fractional() { new RadiusEffectStrategy(1.5); });
});

it("renders transformation before falling and refills only normal cells", function controllerTurn() {
    globalThis.cc = { math: { randomRangeInt: function lowest(min: number) { return min; } } } as any;
    const { model, engine } = board(4, 2);
    const calls: string[] = [];
    const controller = new BoardController(model, {
        initRender(): void {},
        removeTiles(_indices, count): void { assert.equal(count, 7); calls[calls.length] = "remove"; },
        transformTile(index, kind): void { assert.equal(index, 7); assert.equal(kind, 1); calls[calls.length] = "transform"; },
        fallTiles(_moves, count, _cells, _spawned, spawnCount, kinds): void {
            assert.equal(count, 1);
            assert.equal(spawnCount, 7);
            assert.deepEqual(kinds, [0, 1, 0, 0, 0, 0, 0, 0]);
            calls[calls.length] = "fall";
        }
    }, engine, new SpawnService(1));
    controller.init();
    controller.onCellClicked(7);
    assert.deepEqual(calls, ["remove", "transform", "fall"]);
});


it("supports equal thresholds from the scene with last-rule priority", function equalThresholds() {
    const creation = new ThresholdCreationStrategy([
        { kind: 1, minimumGroupSize: 5 }, { kind: 2, minimumGroupSize: 5 },
        { kind: 3, minimumGroupSize: 7 }, { kind: 4, minimumGroupSize: 10 }
    ]);
    assert.equal(creation.selectKind(4), 0);
    assert.equal(creation.selectKind(5), 2);
    assert.equal(creation.selectKind(6), 2);
    assert.equal(creation.selectKind(7), 3);
    assert.equal(creation.selectKind(10), 4);
    assert.equal(new ThresholdCreationStrategy([{ kind: 1, minimumGroupSize: 2 }]).selectKind(2), 1);
    assert.throws(function tooSmall() { new ThresholdCreationStrategy([{ kind: 1, minimumGroupSize: 1 }]); });
});
