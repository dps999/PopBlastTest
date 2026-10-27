import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoardController } from "../assets/scripts/board/BoardController.ts";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";
import type { RemoveStep } from "../assets/scripts/board/IBoardEngine.ts";

describe("BoardController", () => {
    it("processes the clicked cell synchronously", () => {
        const calls: string[] = [];
        let clickedIndex = -1;
        const controller = new BoardController(
            { init(): void {}, getCells(): number[] { return []; }, removeCells(): void {} },
            { initRender(): void {}, removeTiles(): void {} },
            {
                processClick(index: number) {
                    clickedIndex = index;
                    calls.push("processClick");
                    return { valid: false, steps: [] };
                }
            }
        );
        controller.onCellClicked(12);
        calls.push("returned");

        assert.equal(clickedIndex, 12);
        assert.deepEqual(calls, ["processClick", "returned"]);
    });

    it("initializes the model before reading cells and rendering exactly once", () => {
        const calls: string[] = [];
        const cells = [2, 0, 1];
        let currentCells: number[] = [];
        const model = {
            init(): void {
                calls.push("init");
                currentCells = cells;
            },
            getCells(): number[] {
                calls.push("getCells");
                return currentCells;
            },
            removeCells(): void {}
        };
        const view = {
            initRender(renderedCells: number[]): void {
                calls.push("initRender");
                assert.strictEqual(renderedCells, cells);
                assert.deepEqual(renderedCells, [2, 0, 1]);
            },
            removeTiles(): void {}
        };
        const controller = new BoardController(model, view, {
            processClick() {
                return { valid: false, steps: [] };
            }
        });

        assert.deepEqual(calls, []);

        controller.init();

        assert.deepEqual(calls, ["init", "getCells", "initRender"]);
    });

    it("renders the configured board supplied by BoardModel", () => {
        const model = new BoardModel(2, 3);
        const renderedBoards: number[][] = [];
        const controller = new BoardController(model, {
            initRender(cells: number[]): void {
                renderedBoards.push(cells);
            },
            removeTiles(): void {}
        }, new BoardEngine(model, 3));

        controller.init();

        assert.equal(renderedBoards.length, 1);
        assert.strictEqual(renderedBoards[0], model.getCells());
        assert.deepEqual(renderedBoards[0], [-1, -1, -1, -1, -1, -1]);
    });

    it("forwards removal steps in order and ignores an invalid turn", () => {
        const removals: number[][] = [];
        const steps: RemoveStep[] = [
            { type: "remove", indices: [0, 1] },
            { type: "remove", indices: [4, 5] }
        ];
        const controller = new BoardController(
            { init(): void {}, getCells(): number[] { return []; }, removeCells(): void {} },
            {
                initRender(): void {},
                removeTiles(indices: number[]): void {
                    removals.push(indices);
                }
            },
            {
                processClick(index: number) {
                    return { valid: index === 0, steps };
                }
            }
        );

        controller.onCellClicked(0);
        assert.deepEqual(removals, [[0, 1], [4, 5]]);
        assert.strictEqual(removals[0], steps[0].indices);

        controller.onCellClicked(3);
        assert.equal(removals.length, 2);
    });
});
