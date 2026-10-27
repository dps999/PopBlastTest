import type { IBoardModel } from "./BoardController";

export class BoardModel implements IBoardModel {
    private cells: number[] = [];

    public init(): void {
    }

    public getCells(): number[] {
        return this.cells;
    }
}
