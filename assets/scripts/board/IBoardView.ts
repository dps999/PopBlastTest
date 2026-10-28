import type { CellMove } from "./IBoardEngine";

export interface IBoardView {
    initRender(cells: number[], kinds?: number[]): void;

    transformTile(index: number, kind: number): void;

    removeTiles(indices: number[], count: number): void;

    /** Синхронно потребляет префиксы буферов и запускает общее падение. */
    fallTiles(moves: CellMove[], moveCount: number, cells: number[], spawnedIndices: number[], spawnCount: number, kinds?: number[]): void;
}
