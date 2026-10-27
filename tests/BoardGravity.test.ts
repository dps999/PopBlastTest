import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";

function createBoard(values: number[], columns: number): { model: BoardModel; engine: BoardEngine } {
    const model = new BoardModel(values.length / columns, columns);
    const engine = new BoardEngine(model, columns, values.length);
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
        assert.deepEqual(result.removedIndices.slice(0, result.matchCount), [0, 1]);
        assert.deepEqual(result.moves.slice(0, result.moveCount), [{ from: 2, to: 0 }, { from: 3, to: 1 }, { from: 4, to: 2 }]);
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
        assert.deepEqual(result.moves.slice(0, result.moveCount), [{ from: 3, to: 0 }, { from: 9, to: 3 }, { from: 4, to: 1 }, { from: 7, to: 4 }]);
    });

    it("keeps lower tiles in place when only the top group is removed", () => {
        const { model, engine } = createBoard([0, 1, 2, 2], 1);

        const result = engine.processClick(3);

        assert.deepEqual(model.getCells(), [0, 1, -1, -1]);
        assert.deepEqual(result.removedIndices.slice(0, result.matchCount), [3, 2]);
        assert.equal(result.moveCount, 0);
    });

    it("leaves a fully removed column empty without shifting neighboring columns", () => {
        const { model, engine } = createBoard([
            1, 2,
            1, 3,
            1, 4
        ], 2);

        const result = engine.processClick(0);

        assert.deepEqual(model.getCells(), [-1, 2, -1, 3, -1, 4]);
        assert.equal(result.moveCount, 0);
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
        assert.deepEqual(result.removedIndices.slice(0, result.matchCount), [1, 2]);
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

        for (let i = 0; i < result.matchCount; i++) {
            replay[result.removedIndices[i]] = -1;
        }
        for (let i = 0; i < result.moveCount; i++) {
            const move = result.moves[i];
            assert.ok(move.to < move.from);
            assert.equal(move.from % 3, move.to % 3);
            assert.equal(replay[move.to], -1);
            assert.ok(replay[move.from] >= 0);
            replay[move.to] = replay[move.from];
            replay[move.from] = -1;
        }

        assert.deepEqual(replay, model.getCells());
    });

    it("reuses the fixed move array and its objects between clicks", () => {
        const { engine } = createBoard([0, 0, 1, 2, 2, 3], 1);
        const first = engine.processClick(0);
        const moves = first.moves;
        const firstMove = moves[0];
        const secondMove = moves[1];
        assert.equal(first.moveCount, 4);
        assert.equal(moves.length, 6);
        assert.notStrictEqual(firstMove, secondMove);

        const second = engine.processClick(1);

        assert.strictEqual(second.moves, moves);
        assert.strictEqual(moves[0], firstMove);
        assert.strictEqual(moves[1], secondMove);
        assert.equal(second.moveCount, 1);
        assert.deepEqual(moves[0], { from: 3, to: 1 });
        assert.equal(moves.length, 6);

        const invalid = engine.processClick(-1);
        assert.equal(invalid.valid, false);
        assert.equal(invalid.moveCount, 0);
        assert.strictEqual(invalid.moves, moves);
        assert.equal(moves.length, 6);
    });
});
