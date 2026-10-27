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

function createEngine(cells: number[], columns: number): BoardEngine {
    return new BoardEngine({
        init(): void {},
        getCells(): number[] {
            return cells;
        },
        removeCells(indices: number[]): void {
            for (const index of indices) {
                cells[index] = -1;
            }
        }
    }, columns);
}

describe("BoardEngine", () => {
    it("adapts the visited buffer when the model is initialized after the engine", () => {
        let cells: number[] = [];
        const engine = new BoardEngine({
            init(): void {},
            getCells(): number[] {
                return cells;
            },
            removeCells(indices: number[]): void {
                for (const index of indices) {
                    cells[index] = -1;
                }
            }
        }, 2);

        cells = [0, 0, 0, 0];

        assert.deepEqual(engine.findGroup(0).sort(), [0, 1, 2, 3]);
        assert.deepEqual(engine.findGroup(3).sort(), [0, 1, 2, 3]);
    });

    it("removes the group and returns its indices synchronously", () => {
        const cells = [0, 0, 1];
        const engine = createEngine(cells, 3);

        assert.deepEqual(engine.processClick(0), {
            valid: true,
            steps: [{ type: "remove", indices: [0, 1] }]
        });
        assert.deepEqual(cells, [-1, -1, 1]);
        assert.deepEqual(engine.processClick(0), { valid: false, steps: [] });
        assert.deepEqual(engine.processClick(2), { valid: false, steps: [] });
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
            const matches = engine.findGroup(index);
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

        assert.deepEqual((engine.findGroup(0)).sort(), [0, 1]);
    });

    it("does not wrap between the right and left edges of adjacent rows", () => {
        const engine = createEngine([
            0, 1, 2,
            2, 3, 4
        ], 3);

        assert.deepEqual(engine.findGroup(2), []);
        assert.deepEqual(engine.findGroup(3), []);
    });

    it("does not treat a diagonal-only pair as a connected group", () => {
        const engine = createEngine([
            0, 1,
            1, 0
        ], 2);

        for (const index of [0, 1, 2, 3]) {
            assert.deepEqual(engine.findGroup(index), []);
        }
    });

    it("keeps horizontal groups separate where adjacent rows meet", () => {
        const engine = createEngine([
            0, 0, 1, 1,
            1, 1, 0, 0
        ], 4);

        assert.deepEqual(engine.findGroup(3).sort(), [2, 3]);
        assert.deepEqual(engine.findGroup(4).sort(), [4, 5]);
    });

    it("visits each cell only once in a group containing a cycle", () => {
        const matches = createEngine([0, 0, 0, 0], 2).findGroup(0);

        assert.deepEqual(matches.sort(), [0, 1, 2, 3]);
    });

    it("supports single-column and single-row boards", () => {
        assert.deepEqual((createEngine([2, 2, 3], 1).findGroup(0)).sort(), [0, 1]);
        assert.deepEqual((createEngine([2, 2, 3], 3).findGroup(0)).sort(), [0, 1]);
    });

    it("ignores empty cells and invalid indices", () => {
        const engine = createEngine([-1, -1, 0, 0], 2);

        for (const index of [0, 1, -1, 4, 0.5, NaN, Infinity]) {
            assert.deepEqual(engine.findGroup(index), []);
        }
        assert.deepEqual(createEngine([], 3).findGroup(0), []);
    });

    it("reads the current model cells on every click", () => {
        const cells = [0, 0];
        const engine = createEngine(cells, 2);
        assert.deepEqual((engine.findGroup(0)).sort(), [0, 1]);

        cells[1] = 1;

        assert.deepEqual(engine.findGroup(0), []);
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

        assert.deepEqual(result, { valid: false, steps: [] });
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
        assert.equal(result.steps.length, 1);
        assert.equal(result.steps[0].type, "remove");
        assert.deepEqual([...result.steps[0].indices].sort((a, b) => a - b), [0, 1, 4]);
        assert.strictEqual(model.getCells(), cells);
        assert.deepEqual(cells, [
            -1, -1, 1, 2,
            -1, 1, 2, 2,
            3, 3, 0, 0
        ]);
    });

    for (const columns of [1, 5]) {
        it(`does not connect groups through an empty cell with ${columns} columns`, () => {
            const { model, engine } = createBoard([2, 2, -1, 2, 2], columns);

            const result = engine.processClick(0);

            assert.equal(result.valid, true);
            assert.deepEqual([...result.steps[0].indices].sort(), [0, 1]);
            assert.deepEqual(model.getCells(), [-1, -1, -1, 2, 2]);
        });
    }

    it("ignores a repeated click and can remove another group at its original indices", () => {
        const { model, engine } = createBoard([0, 0, 1, 2, 2], 5);
        const firstResult = engine.processClick(0);
        const firstIndices = firstResult.steps[0].indices.slice();

        const repeatedResult = engine.processClick(1);

        assert.deepEqual(repeatedResult, { valid: false, steps: [] });
        assert.deepEqual(model.getCells(), [-1, -1, 1, 2, 2]);

        const secondResult = engine.processClick(4);

        assert.equal(secondResult.valid, true);
        assert.deepEqual([...secondResult.steps[0].indices].sort(), [3, 4]);
        assert.deepEqual(model.getCells(), [-1, -1, 1, -1, -1]);
        assert.deepEqual(firstResult.steps[0].indices, firstIndices);
    });

    it("removes every cell of a uniform 8 by 8 board exactly once", () => {
        const { model, engine } = createBoard(new Array<number>(64).fill(3), 8);

        const result = engine.processClick(63);

        assert.equal(result.valid, true);
        assert.equal(result.steps.length, 1);
        assert.deepEqual(
            [...result.steps[0].indices].sort((a, b) => a - b),
            Array.from({ length: 64 }, (_, index) => index)
        );
        assert.deepEqual(model.getCells(), new Array<number>(64).fill(-1));
        assert.deepEqual(engine.processClick(0), { valid: false, steps: [] });
    });

    it("does not change the model for empty cells or invalid click indices", () => {
        const values = [-1, 0, 0, 1];
        const { model, engine } = createBoard(values, 2);
        const cells = model.getCells();

        for (const index of [0, -1, values.length, 0.5, NaN, Infinity]) {
            assert.deepEqual(engine.processClick(index), { valid: false, steps: [] });
            assert.strictEqual(model.getCells(), cells);
            assert.deepEqual(cells, values);
        }
    });
});

it.todo("Refill fills all empty cells with integer color indices in [0, colorCount)");
