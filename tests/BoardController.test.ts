import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoardController } from "../assets/scripts/board/BoardController.ts";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";

describe("BoardController", () => {
    it("processes the clicked cell synchronously", () => {
        const calls: string[] = [];
        let clickedIndex = -1;
        const controller = new BoardController(
            { init(): void {}, getCells(): number[] { return []; } },
            { initRender(): void {} },
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
            }
        };
        const view = {
            initRender(renderedCells: number[]): void {
                calls.push("initRender");
                assert.strictEqual(renderedCells, cells);
                assert.deepEqual(renderedCells, [2, 0, 1]);
            }
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
            }
        }, new BoardEngine(model, 3));

        controller.init();

        assert.equal(renderedBoards.length, 1);
        assert.strictEqual(renderedBoards[0], model.getCells());
        assert.deepEqual(renderedBoards[0], [-1, -1, -1, -1, -1, -1]);
    });
});
