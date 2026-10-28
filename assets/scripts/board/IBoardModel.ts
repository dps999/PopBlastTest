export interface IBoardModel {
    init(): void;

    getCells(): number[];

    getTileKinds(): number[];

    transformCell(index: number, kind: number): void;

    removeCells(indices: number[], count: number): void;

    moveCell(from: number, to: number): void;
}
