export interface IBoardModel {
    init(): void;

    getCells(): number[];

    transformCell(index: number, value: number): void;

    removeCells(indices: number[], count: number): void;

    moveCell(from: number, to: number): void;
}
