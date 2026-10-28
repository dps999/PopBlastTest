import type { TurnResult } from "../board/IBoardEngine";
import type { IBoosterBoardActions, IBoosterEffectStrategy } from "./BoosterContracts";

export class BombBoosterStrategy implements IBoosterEffectStrategy {
    public readonly targetCount: number = 1;
    private readonly columns: number;
    private readonly rows: number;
    private readonly radius: number;
    private readonly targets: number[];

    constructor(columns: number, capacity: number, radius: number) {
        if (!Number.isInteger(radius) || radius < 1) {
            throw new Error("Booster bomb radius must be a positive integer.");
        }
        this.columns = columns;
        this.rows = capacity / columns;
        this.radius = radius;
        this.targets = new Array<number>(capacity).fill(0);
    }

    public canSelect(index: number, cells: number[], _selected: number[], _selectedCount: number): boolean {
        return Number.isInteger(index) && index >= 0 && index < cells.length && cells[index] >= 0;
    }

    public execute(selected: number[], board: IBoosterBoardActions): TurnResult {
        const column = selected[0] % this.columns;
        const row = Math.floor(selected[0] / this.columns);
        const firstRow = Math.max(0, row - this.radius);
        const lastRow = Math.min(this.rows - 1, row + this.radius);
        const firstColumn = Math.max(0, column - this.radius);
        const lastColumn = Math.min(this.columns - 1, column + this.radius);
        let count = 0;
        for (let y = firstRow; y <= lastRow; y++) {
            for (let x = firstColumn; x <= lastColumn; x++) {
                this.targets[count++] = y * this.columns + x;
            }
        }
        return board.processRemoval(this.targets, count);
    }
}
