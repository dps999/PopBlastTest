import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoardController } from "../assets/scripts/board/BoardController.ts";
import { BoardModel } from "../assets/scripts/board/BoardModel.ts";
import { BoardEngine } from "../assets/scripts/board/BoardEngine.ts";
import type { CellMove } from "../assets/scripts/board/IBoardEngine.ts";
import { SpawnService } from "../assets/scripts/board/SpawnService.ts";

function lowestInteger(min: number, _max: number): number {
    return min;
}

Object.defineProperty(globalThis, "cc", {
    configurable: true,
    value: { math: { randomRangeInt: lowestInteger } }
});

describe("BoardController", () => {
    it("processes the clicked cell synchronously", () => {
        const calls: string[] = [];
        let clickedIndex = -1;
        const controller = new BoardController(
            { init(): void {}, transformCell(): void {}, getCells(): number[] { return []; }, removeCells(): void {}, moveCell(): void {} },
            { initRender(): void {}, removeTiles(): void {}, fallTiles(): void {} },
            {
                processClick(index: number) {
                    clickedIndex = index;
                    calls.push("processClick");
                    return { valid: false, removedIndices: [], matchCount: 0, moves: [], moveCount: 0 };
                }
            },
            new SpawnService(1)
        );
        controller.onCellClicked(12);
        calls.push("returned");

        assert.equal(clickedIndex, 12);
        assert.deepEqual(calls, ["processClick", "returned"]);
    });

    it("initializes the model and spawns colors before rendering exactly once", () => {
        const calls: string[] = [];
        const cells = [-1, -1, -1];
        let currentCells: number[] = [];
        const model = {
            transformCell(): void {},
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
            initRender(renderedCells: ReadonlyArray<number>): void {
                calls.push("initRender");
                assert.strictEqual(renderedCells, cells);
                assert.deepEqual(renderedCells, [2, 0, 1]);
            },
            removeTiles(): void {},
            fallTiles(): void {}
        };
        const controller = new BoardController(model, view, {
            processClick() {
                return { valid: false, removedIndices: [], matchCount: 0, moves: [], moveCount: 0 };
            }
        }, {
            spawn(spawnedCells: number[]): number {
                calls[calls.length] = "spawn";
                assert.strictEqual(spawnedCells, cells);
                assert.deepEqual(spawnedCells, [-1, -1, -1]);
                spawnedCells[0] = 2;
                spawnedCells[1] = 0;
                spawnedCells[2] = 1;
                return 3;
            }
        });

        assert.deepEqual(calls, []);

        controller.init();

        assert.deepEqual(calls, ["init", "getCells", "spawn", "initRender"]);
    });

    it("renders the configured board supplied by BoardModel", () => {
        const model = new BoardModel(2, 3);
        const renderedBoards: ReadonlyArray<number>[] = [];
        const controller = new BoardController(model, {
            initRender(cells: ReadonlyArray<number>): void {
                renderedBoards[renderedBoards.length] = cells;
            },
            removeTiles(): void {},
            fallTiles(): void {}
        }, new BoardEngine(model, 3, 6), new SpawnService(1));

        controller.init();

        assert.equal(renderedBoards.length, 1);
        assert.strictEqual(renderedBoards[0], model.getCells());
        assert.deepEqual(renderedBoards[0], [0, 0, 0, 0, 0, 0]);
    });

    it("removes tiles before moving them and ignores an invalid turn", () => {
        const calls: string[] = [];
        const removedIndices = [0, 1, 4, 5];
        const matchCount = 2;
        const moves: CellMove[] = [{ from: 3, to: 0 }, { from: 4, to: 1 }];
        let moveCount = 2;
        const controller = new BoardController(
            { init(): void {}, transformCell(): void {}, getCells(): number[] { return []; }, removeCells(): void {}, moveCell(): void {} },
            {
                initRender(): void {},
                removeTiles(indices: number[], count: number): void {
                    assert.strictEqual(indices, removedIndices);
                    assert.equal(count, matchCount);
                    calls.push("remove");
                },
                fallTiles(actualMoves: CellMove[], count: number): void {
                    assert.strictEqual(actualMoves, moves);
                    assert.equal(count, moveCount);
                    calls.push("fall");
                }
            },
            {
                processClick(index: number) {
                    return { valid: index === 0, removedIndices, matchCount, removedCount: matchCount, transformedIndex: -1, transformedValue: -1, moves, moveCount };
                }
            },
            new SpawnService(1)
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

it("refills a complete turn and reuses only the current spawn prefix", function completeTurn(): void {
    const model = new BoardModel(4, 2);
    const cells = model.getCells();
    let renderCalls = 0;
    let fallCalls = 0;
    let previousIndices: number[] | null = null;
    let expectedSpawns: number[] = [];
    let spawnCalls = 0;
    const service = new SpawnService(1);
    const controller = new BoardController(model, {
        initRender(): void { renderCalls++; },
        removeTiles(): void {
            assert.ok(model.getCells().every(function filled(color) { return color >= 0; }));
        },
        fallTiles(moves, moveCount, actualCells, indices, count): void {
            assert.strictEqual(actualCells, model.getCells());
            assert.deepEqual(indices.slice(0, count), expectedSpawns);
            assert.equal(indices.length, 8);
            if (previousIndices) {
                assert.strictEqual(indices, previousIndices);
            }
            previousIndices = indices;
            assert.equal(moveCount, fallCalls === 0 ? 2 : 0);
            if (moveCount > 0) {
                assert.deepEqual(moves.slice(0, moveCount), [{ from: 4, to: 0 }, { from: 6, to: 2 }]);
            }
            fallCalls++;
        }
    }, new BoardEngine(model, 2, 8), {
        spawn(values, indices): number {
            spawnCalls++;
            return service.spawn(values, indices);
        }
    });
    controller.init();
    const current = model.getCells();
    current.splice(0, 8, 1, 2, 1, 3, 4, 2, 3, 4);
    expectedSpawns = [4, 6];
    controller.onCellClicked(0);
    assert.deepEqual(current, [4, 2, 3, 3, 0, 2, 0, 4]);

    current[5] = 4;
    expectedSpawns = [5, 7];
    controller.onCellClicked(7);
    assert.deepEqual(current, [4, 2, 3, 3, 0, 0, 0, 0]);

    controller.onCellClicked(-1);
    assert.equal(renderCalls, 1);
    assert.equal(fallCalls, 2);
    assert.equal(spawnCalls, 3);
    assert.notStrictEqual(cells, current);
});

it("refills a completely cleared board", function refillWholeBoard(): void {
    const model = new BoardModel(2, 2);
    let falls = 0;
    const controller = new BoardController(model, {
        initRender(): void {},
        removeTiles(_indices, count): void { assert.equal(count, 4); },
        fallTiles(_moves, moveCount, cells, indices, count): void {
            falls++;
            assert.equal(moveCount, 0);
            assert.equal(count, 4);
            assert.deepEqual(indices, [0, 1, 2, 3]);
            assert.deepEqual(cells, [0, 0, 0, 0]);
        }
    }, new BoardEngine(model, 2, 4), new SpawnService(1));
    controller.init();
    controller.onCellClicked(0);
    assert.equal(falls, 1);
});
