export interface IBoardView {
    initRender(cells: number[]): void;

    removeTiles(indices: number[]): void;
}
