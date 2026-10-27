import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";

function createEngine(cells: number[], columns: number): BoardEngine {
    return new BoardEngine({
        init(): void {},
        getCells(): number[] {
            return cells;
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
            }
        }, 2);

        cells = [0, 0, 0, 0];

        assert.deepEqual(engine.findGroup(0).sort(), [0, 1, 2, 3]);
        assert.deepEqual(engine.findGroup(3).sort(), [0, 1, 2, 3]);
    });

    it("returns the turn result synchronously", () => {
        const engine = createEngine([0, 0, 1], 3);

        assert.deepEqual(engine.processClick(0), { valid: true, steps: [] });
        assert.deepEqual(engine.processClick(2), { valid: false, steps: [] });
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
