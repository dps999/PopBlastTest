import type { IBoardModel } from "./IBoardModel";

export class BoardModel implements IBoardModel {
    private cells: number[] = [];
    private kinds: number[] = [];
    private readonly rows: number;
    private readonly columns: number;

    constructor(rows: number, columns: number) {
        this.rows = rows;
        this.columns = columns;
    }

    public init(): void {
        this.cells = new Array<number>(this.rows * this.columns).fill(-1);
        this.kinds = new Array<number>(this.cells.length).fill(0);
    }

    public getCells(): number[] {
        return this.cells;
    }

    public getTileKinds(): number[] {
        return this.kinds;
    }

    public transformCell(index: number, kind: number): void {
        this.kinds[index] = kind;
        this.cells[index] = 0;
    }

    public removeCells(indices: number[], count: number): void {
        for (let i = 0; i < count; i++) {
            this.cells[indices[i]] = -1;
            this.kinds[indices[i]] = 0;
        }
    }

    public moveCell(from: number, to: number): void {
        this.cells[to] = this.cells[from];
        this.cells[from] = -1;
        this.kinds[to] = this.kinds[from];
        this.kinds[from] = 0;
    }
}
