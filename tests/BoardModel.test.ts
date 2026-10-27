import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";

describe("BoardModel", () => {
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
