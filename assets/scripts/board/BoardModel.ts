import type { IBoardModel } from "./IBoardModel";

export class BoardModel implements IBoardModel {
    private cells: number[] = [];
    private readonly rows: number;
    private readonly columns: number;

    constructor(rows: number, columns: number) {
        this.rows = rows;
        this.columns = columns;
    }

    public init(): void {
        this.cells = new Array<number>(this.rows * this.columns).fill(-1);
    }

    public getCells(): number[] {
        return this.cells;
    }
}
