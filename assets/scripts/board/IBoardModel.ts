export interface IBoardModel {
    init(): void;

    getCells(): number[];

    removeCells(indices: number[]): void;
}
