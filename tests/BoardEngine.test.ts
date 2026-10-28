import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";
import type { TurnResult } from "../assets/scripts/board/IBoardEngine.ts";

function assertInvalid(result: TurnResult): void {
    assert.equal(result.valid, false);
    assert.equal(result.matchCount, 0);
    assert.equal(result.moveCount, 0);
}

function readGroup(engine: BoardEngine, index: number, capacity: number): number[] {
    const matches = new Array<number>(capacity).fill(0);
    const count = engine.findGroup(index, matches);
    assert.equal(matches.length, capacity);
    return matches.slice(0, count);
}

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

function createEngine(cells: number[], columns: number): BoardEngine {
    return new BoardEngine({
        init(): void {}, getTileKinds(): number[] { return new Array(100).fill(0); }, transformCell(): void {},
        getCells(): number[] {
            return cells;
        },
        removeCells(indices: number[], count: number): void {
            for (let i = 0; i < count; i++) {
                cells[indices[i]] = -1;
            }
        },
        moveCell(from: number, to: number): void {
            cells[to] = cells[from];
            cells[from] = -1;
        }
    }, columns, cells.length);
}

describe("BoardEngine", () => {
    it("adapts the visited buffer when the model is initialized after the engine", () => {
        let cells: number[] = [];
        const engine = new BoardEngine({
            init(): void {}, getTileKinds(): number[] { return new Array(100).fill(0); }, transformCell(): void {},
            getCells(): number[] {
                return cells;
            },
            removeCells(indices: number[], count: number): void {
                for (let i = 0; i < count; i++) {
                    cells[indices[i]] = -1;
                }
            },
            moveCell(from: number, to: number): void {
                cells[to] = cells[from];
                cells[from] = -1;
            }
        }, 2, 4);

        cells = [0, 0, 0, 0];

        assert.deepEqual(readGroup(engine, 0, 4).sort(), [0, 1, 2, 3]);
        assert.deepEqual(readGroup(engine, 3, 4).sort(), [0, 1, 2, 3]);
    });

    it("removes the group and returns its indices synchronously", () => {
        const cells = [0, 0, 1];
        const engine = createEngine(cells, 3);

        const result = engine.processClick(0);
        assert.equal(result.valid, true);
        assert.equal(result.matchCount, 2);
        assert.deepEqual(result.removedIndices.slice(0, result.matchCount), [0, 1]);
        assert.equal(result.moveCount, 0);
        assert.equal(result.moves.length, 3);
        assert.deepEqual(cells, [-1, -1, 1]);
        assertInvalid(engine.processClick(0));
        assertInvalid(engine.processClick(2));
        assert.deepEqual(cells, [-1, -1, 1]);
    });

    it("finds a connected group across rows and columns from the bottom row", () => {
        const cells = [
            1, 1, 2,
            2, 1, 2,
            1, 1, 2
        ];
        const engine = createEngine(cells, 3);

        for (const index of [0, 1, 4, 6, 7]) {
            const matches = readGroup(engine, index, cells.length);
            assert.deepEqual(matches.sort((a, b) => a - b), [0, 1, 4, 6, 7]);
        }
        assert.deepEqual(cells, [1, 1, 2, 2, 1, 2, 1, 1, 2]);
    });

    it("does not connect diagonals or disconnected groups of the same color", () => {
        const engine = createEngine([
            0, 0, 1,
            1, 1, 0,
            0, 0, 1
        ], 3);

        assert.deepEqual(readGroup(engine, 0, 9).sort(), [0, 1]);
    });

    it("does not wrap between the right and left edges of adjacent rows", () => {
        const engine = createEngine([
            0, 1, 2,
            2, 3, 4
        ], 3);

        assert.deepEqual(readGroup(engine, 2, 6), []);
        assert.deepEqual(readGroup(engine, 3, 6), []);
    });

    it("does not treat a diagonal-only pair as a connected group", () => {
        const engine = createEngine([
            0, 1,
            1, 0
        ], 2);

        for (const index of [0, 1, 2, 3]) {
            assert.deepEqual(readGroup(engine, index, 4), []);
        }
    });

    it("keeps horizontal groups separate where adjacent rows meet", () => {
        const engine = createEngine([
            0, 0, 1, 1,
            1, 1, 0, 0
        ], 4);

        assert.deepEqual(readGroup(engine, 3, 8).sort(), [2, 3]);
        assert.deepEqual(readGroup(engine, 4, 8).sort(), [4, 5]);
    });

    it("visits each cell only once in a group containing a cycle", () => {
        const matches = readGroup(createEngine([0, 0, 0, 0], 2), 0, 4);

        assert.deepEqual(matches.sort(), [0, 1, 2, 3]);
    });

    it("supports single-column and single-row boards", () => {
        assert.deepEqual(readGroup(createEngine([2, 2, 3], 1), 0, 3).sort(), [0, 1]);
        assert.deepEqual(readGroup(createEngine([2, 2, 3], 3), 0, 3).sort(), [0, 1]);
    });

    it("ignores empty cells and invalid indices", () => {
        const engine = createEngine([-1, -1, 0, 0], 2);

        for (const index of [0, 1, -1, 4, 0.5, NaN, Infinity]) {
            assert.deepEqual(readGroup(engine, index, 4), []);
        }
        assert.deepEqual(readGroup(createEngine([], 3), 0, 0), []);
    });

    it("reads the current model cells on every click", () => {
        const cells = [0, 0];
        const engine = createEngine(cells, 2);
        assert.deepEqual(readGroup(engine, 0, 2).sort(), [0, 1]);

        cells[1] = 1;

        assert.deepEqual(readGroup(engine, 0, 2), []);
    });
});

describe("BoardEngine removal with BoardModel", () => {
    it("leaves a solitary tile and the entire model unchanged", () => {
        const values = [
            0, 1, 0,
            1, 2, 1,
            0, 1, 0
        ];
        const { model, engine } = createBoard(values, 3);
        const cells = model.getCells();

        const result = engine.processClick(4);

        assertInvalid(result);
        assert.strictEqual(model.getCells(), cells);
        assert.deepEqual(cells, values);
    });

    it("removes only the clicked connected group and preserves a separate group of the same color", () => {
        const { model, engine } = createBoard([
            0, 0, 1, 2,
            0, 1, 2, 2,
            3, 3, 0, 0
        ], 4);
        const cells = model.getCells();

        const result = engine.processClick(0);

        assert.equal(result.valid, true);
        assert.equal(result.moveCount, 3);
        assert.deepEqual(result.removedIndices.slice(0, result.matchCount).sort((a, b) => a - b), [0, 1, 4]);
        assert.strictEqual(model.getCells(), cells);
        assert.deepEqual(cells, [
            3, 1, 1, 2,
            -1, 3, 2, 2,
            -1, -1, 0, 0
        ]);
    });

    for (const columns of [1, 5]) {
        it(`does not connect groups through an empty cell with ${columns} columns`, () => {
            const { model, engine } = createBoard([2, 2, -1, 2, 2], columns);

            const result = engine.processClick(0);

            assert.equal(result.valid, true);
            assert.deepEqual(result.removedIndices.slice(0, result.matchCount).sort(), [0, 1]);
            assert.deepEqual(model.getCells(), columns === 1 ? [2, 2, -1, -1, -1] : [-1, -1, -1, 2, 2]);
        });
    }

    it("ignores a repeated click and can remove another group at its original indices", () => {
        const { model, engine } = createBoard([0, 0, 1, 2, 2], 5);
        const firstResult = engine.processClick(0);
        const firstIndices = firstResult.removedIndices.slice(0, firstResult.matchCount);

        const repeatedResult = engine.processClick(1);

        assertInvalid(repeatedResult);
        assert.deepEqual(model.getCells(), [-1, -1, 1, 2, 2]);

        const secondResult = engine.processClick(4);

        assert.equal(secondResult.valid, true);
        assert.deepEqual(secondResult.removedIndices.slice(0, secondResult.matchCount).sort(), [3, 4]);
        assert.deepEqual(model.getCells(), [-1, -1, 1, -1, -1]);
        assert.deepEqual(firstIndices, [0, 1]);
        assert.strictEqual(secondResult.removedIndices, firstResult.removedIndices);
    });

    it("removes every cell of a uniform 8 by 8 board exactly once", () => {
        const { model, engine } = createBoard(new Array<number>(64).fill(3), 8);

        const result = engine.processClick(63);

        assert.equal(result.valid, true);
        assert.equal(result.moveCount, 0);
        assert.deepEqual(
            result.removedIndices.slice(0, result.matchCount).sort((a, b) => a - b),
            Array.from({ length: 64 }, (_, index) => index)
        );
        assert.deepEqual(model.getCells(), new Array<number>(64).fill(-1));
        assertInvalid(engine.processClick(0));
    });

    it("does not change the model for empty cells or invalid click indices", () => {
        const values = [-1, 0, 0, 1];
        const { model, engine } = createBoard(values, 2);
        const cells = model.getCells();

        for (const index of [0, -1, values.length, 0.5, NaN, Infinity]) {
            assertInvalid(engine.processClick(index));
            assert.strictEqual(model.getCells(), cells);
            assert.deepEqual(cells, values);
        }
    });

    it("reuses the fixed matches array and removes only the current prefix", () => {
        const { model, engine } = createBoard([0, 0, 0, 0, 0, 0], 6);
        const first = engine.processClick(0);
        const matches = first.removedIndices;
        assert.equal(first.matchCount, 6);
        assert.equal(matches.length, 6);

        const cells = model.getCells();
        const values = [1, 1, 2, 3, 4, 0];
        for (let i = 0; i < values.length; i++) {
            cells[i] = values[i];
        }

        const second = engine.processClick(0);

        assert.strictEqual(second.removedIndices, matches);
        assert.equal(second.matchCount, 2);
        assert.equal(matches.length, 6);
        assert.deepEqual(matches.slice(0, second.matchCount), [0, 1]);
        assert.deepEqual(cells, [-1, -1, 2, 3, 4, 0]);

        const invalid = engine.processClick(-1);
        assert.strictEqual(invalid.removedIndices, matches);
        assert.equal(invalid.matchCount, 0);
        assert.equal(matches.length, 6);
    });
});
