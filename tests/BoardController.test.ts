import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoardController } from "../assets/scripts/board/BoardController.ts";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";
import type { CellMove } from "../assets/scripts/board/IBoardEngine.ts";

describe("BoardController", () => {
    it("processes the clicked cell synchronously", () => {
        const calls: string[] = [];
        let clickedIndex = -1;
        const controller = new BoardController(
            { init(): void {}, getCells(): number[] { return []; }, removeCells(): void {}, moveCell(): void {} },
            { initRender(): void {}, removeTiles(): void {}, moveTiles(): void {} },
            {
                processClick(index: number) {
                    clickedIndex = index;
                    calls.push("processClick");
                    return { valid: false, removedIndices: [], moves: [], moveCount: 0 };
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
            removeCells(): void {},
            moveCell(): void {}
        };
        const view = {
            initRender(renderedCells: number[]): void {
                calls.push("initRender");
                assert.strictEqual(renderedCells, cells);
                assert.deepEqual(renderedCells, [2, 0, 1]);
            },
            removeTiles(): void {},
            moveTiles(): void {}
        };
        const controller = new BoardController(model, view, {
            processClick() {
                return { valid: false, removedIndices: [], moves: [], moveCount: 0 };
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
            removeTiles(): void {},
            moveTiles(): void {}
        }, new BoardEngine(model, 3, 6));

        controller.init();

        assert.equal(renderedBoards.length, 1);
        assert.strictEqual(renderedBoards[0], model.getCells());
        assert.deepEqual(renderedBoards[0], [-1, -1, -1, -1, -1, -1]);
    });

    it("removes tiles before moving them and ignores an invalid turn", () => {
        const calls: string[] = [];
        const removedIndices = [0, 1];
        const moves: CellMove[] = [{ from: 3, to: 0 }, { from: 4, to: 1 }];
        let moveCount = 2;
        const controller = new BoardController(
            { init(): void {}, getCells(): number[] { return []; }, removeCells(): void {}, moveCell(): void {} },
            {
                initRender(): void {},
                removeTiles(indices: number[]): void {
                    assert.strictEqual(indices, removedIndices);
                    calls.push("remove");
                },
                moveTiles(actualMoves: CellMove[], count: number): void {
                    assert.strictEqual(actualMoves, moves);
                    assert.equal(count, moveCount);
                    calls.push("fall");
                }
            },
            {
                processClick(index: number) {
                    return { valid: index === 0, removedIndices, moves, moveCount };
                }
            }
        );

        controller.onCellClicked(0);
        assert.deepEqual(calls, ["remove", "fall"]);

        moveCount = 0;
        controller.onCellClicked(0);
        assert.deepEqual(calls, ["remove", "fall", "remove", "fall"]);

        controller.onCellClicked(3);
        assert.equal(calls.length, 4);
        assert.equal(moves.length, 2);
    });
});
