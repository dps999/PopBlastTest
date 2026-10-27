import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { SpawnService } from "../assets/scripts/board/SpawnService.ts";

function lowestInteger(min: number, _max: number): number {
    return min;
}

const cocosStub = { randomRangeInt: lowestInteger };
Object.defineProperty(globalThis, "cc", {
    configurable: true,
    value: cocosStub
});

function highestPaletteInteger(min: number, max: number): number {
    assert.equal(min, 0);
    assert.equal(max, 5);
    return max - 1;
}

it("SpawnService fills only empty cells and preserves their indices", function preserveCells(): void {
    const cells = [-1, 2, -1, 0, 4, -1];
    const service = new SpawnService(1);

    service.spawn(cells);
    service.spawn(cells);

    assert.deepEqual(cells, [0, 2, 0, 0, 4, 0]);
});

it("SpawnService generates both palette boundaries", function paletteBoundaries(): void {
    const cells = [-1, -1, -1];
    const service = new SpawnService(5);

    service.spawn(cells);
    assert.deepEqual(cells, [0, 0, 0]);

    cells.fill(-1);
    const random = mock.method(cocosStub, "randomRangeInt", highestPaletteInteger);
    try {
        service.spawn(cells);
        assert.deepEqual(cells, [4, 4, 4]);
    } finally {
        random.mock.restore();
    }
});

it("SpawnService accepts an empty board", function emptyBoard(): void {
    const cells: number[] = [];
    const service = new SpawnService(5);

    service.spawn(cells);

    assert.deepEqual(cells, []);
});
