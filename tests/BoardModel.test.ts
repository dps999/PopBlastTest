import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";

describe("BoardModel", () => {
    it("moves a cell into an empty position and clears its source", () => {
        const model = new BoardModel(2, 2);
        model.init();
        const cells = model.getCells();
        cells[1] = 2;
        cells[3] = 0;

        model.moveCell(3, 2);

        assert.strictEqual(model.getCells(), cells);
        assert.deepEqual(cells, [-1, 2, 0, -1]);
    });

    it("marks only removed cells as empty while keeping the indices and array", () => {
        const model = new BoardModel(2, 3);
        model.init();
        const cells = model.getCells();
        cells.splice(0, cells.length, 0, 1, 2, 3, 4, 0);

        model.removeCells([1, 4]);

        assert.strictEqual(model.getCells(), cells);
        assert.deepEqual(cells, [0, -1, 2, 3, -1, 0]);
    });

    it("does not change cells when the removal list is empty", () => {
        const model = new BoardModel(1, 3);
        model.init();
        const cells = model.getCells();
        cells[0] = 0;
        cells[1] = 1;
        cells[2] = 2;

        model.removeCells([]);

        assert.strictEqual(model.getCells(), cells);
        assert.deepEqual(cells, [0, 1, 2]);
    });

    it("allows duplicate indices and repeated removal without affecting other cells", () => {
        const model = new BoardModel(1, 3);
        model.init();
        const cells = model.getCells();
        cells[0] = 0;
        cells[1] = 1;
        cells[2] = 2;

        model.removeCells([0, 0, 2]);
        model.removeCells([0, 2]);

        assert.strictEqual(model.getCells(), cells);
        assert.deepEqual(cells, [-1, 1, -1]);
    });

    it("starts with an empty board", () => {
        const model = new BoardModel(2, 3);

        assert.deepEqual(model.getCells(), []);
    });

    it("initializes all cells for the configured rows and columns with minus one", () => {
        const model = new BoardModel(2, 3);

        model.init();

        assert.deepEqual(model.getCells(), [-1, -1, -1, -1, -1, -1]);
    });

    it("keeps cells separate between model instances", () => {
        const first = new BoardModel(2, 3);
        const second = new BoardModel(2, 3);

        first.init();
        second.init();

        assert.notStrictEqual(first.getCells(), second.getCells());
        first.getCells()[0] = 4;
        assert.equal(second.getCells()[0], -1);
    });
});
