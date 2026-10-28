import type { CellMove } from "./IBoardEngine";

export interface IBoardView {
    initRender(cells: number[]): void;

    transformTile(index: number, value: number): void;

    removeTiles(indices: number[], count: number): void;

    swapTiles(first: number, second: number): void;

    setSelectedCell(index: number): void;

    /** Синхронно потребляет префиксы буферов и запускает общее падение. */
    fallTiles(moves: CellMove[], moveCount: number, cells: number[], spawnedIndices: number[], spawnCount: number): void;
}
