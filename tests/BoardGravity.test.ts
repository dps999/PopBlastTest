import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";

function createBoard(values: number[], columns: number): { model: BoardModel; engine: BoardEngine } {
    const model = new BoardModel(values.length / columns, columns);
    const engine = new BoardEngine(model, columns);
    model.init();
    const cells = model.getCells();
    for (let i = 0; i < values.length; i++) {
        cells[i] = values[i];
    }
    return { model, engine };
}

describe("BoardEngine gravity", () => {
    it("compacts a column towards row zero while preserving the order of tiles", () => {
        const { model, engine } = createBoard([1, 1, 2, 3, 4], 1);

        const result = engine.processClick(0);

        assert.deepEqual(model.getCells(), [2, 3, 4, -1, -1]);
        assert.deepEqual(result.removedIndices, [0, 1]);
        assert.deepEqual(result.moves, [{ from: 2, to: 0 }, { from: 3, to: 1 }, { from: 4, to: 2 }]);
    });

    it("compacts columns independently and leaves a full column unchanged", () => {
        const { model, engine } = createBoard([
            0, 0, 1,
            2, 3, 1,
            -1, 4, 2,
            4, -1, 3
        ], 3);
        const cells = model.getCells();

        const result = engine.processClick(0);

        assert.strictEqual(model.getCells(), cells);
        assert.deepEqual(cells, [
            2, 3, 1,
            4, 4, 1,
            -1, -1, 2,
            -1, -1, 3
        ]);
        assert.deepEqual(result.moves, [{ from: 3, to: 0 }, { from: 9, to: 3 }, { from: 4, to: 1 }, { from: 7, to: 4 }]);
    });

    it("keeps lower tiles in place when only the top group is removed", () => {
        const { model, engine } = createBoard([0, 1, 2, 2], 1);

        const result = engine.processClick(3);

        assert.deepEqual(model.getCells(), [0, 1, -1, -1]);
        assert.deepEqual(result.removedIndices, [3, 2]);
        assert.deepEqual(result.moves, []);
    });

    it("leaves a fully removed column empty without shifting neighboring columns", () => {
        const { model, engine } = createBoard([
            1, 2,
            1, 3,
            1, 4
        ], 2);

        const result = engine.processClick(0);

        assert.deepEqual(model.getCells(), [-1, 2, -1, 3, -1, 4]);
        assert.deepEqual(result.moves, []);
    });

    it("skips multiple holes while preserving color zero", () => {
        const { model, engine } = createBoard([2, 2, -1, 0, 1, -1, 4], 1);

        engine.processClick(0);

        assert.deepEqual(model.getCells(), [0, 1, 4, -1, -1, -1, -1]);
    });

    it("processes the next click at the new index of a fallen group", () => {
        const { model, engine } = createBoard([1, 1, 2, 3, 3], 1);
        engine.processClick(0);
        assert.deepEqual(model.getCells(), [2, 3, 3, -1, -1]);

        const result = engine.processClick(1);

        assert.equal(result.valid, true);
        assert.deepEqual(result.removedIndices, [1, 2]);
        assert.deepEqual(model.getCells(), [2, -1, -1, -1, -1]);
    });

    it("applies removal then moves without overwriting a tile and matches the model", () => {
        const values = [
            0, 0, 1,
            2, 3, 1,
            -1, 4, 2,
            4, -1, 3
        ];
        const { model, engine } = createBoard(values, 3);
        const result = engine.processClick(0);
        const replay = values.slice();

        for (const index of result.removedIndices) {
            replay[index] = -1;
        }
        for (const move of result.moves) {
            assert.ok(move.to < move.from);
            assert.equal(move.from % 3, move.to % 3);
            assert.equal(replay[move.to], -1);
            assert.ok(replay[move.from] >= 0);
            replay[move.to] = replay[move.from];
            replay[move.from] = -1;
        }

        assert.deepEqual(replay, model.getCells());
    });
});
