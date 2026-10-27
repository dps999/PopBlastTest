import type { CellMove } from "./IBoardEngine";

export interface IBoardView {
    initRender(cells: number[]): void;

    removeTiles(indices: number[], count: number): void;

    moveTiles(moves: CellMove[], count: number): void;
}
