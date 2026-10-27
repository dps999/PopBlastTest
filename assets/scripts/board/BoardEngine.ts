import type { CellMove, IBoardEngine, TurnResult } from "./IBoardEngine";
import type { IBoardModel } from "./IBoardModel";

/** Доменный сервис игровых правил поля. */
export class BoardEngine implements IBoardEngine {
    private readonly model: IBoardModel;
    private readonly columns: number;
    private readonly moves: CellMove[];
    private readonly matches: number[];

    private visited: Uint8Array;

    constructor(model: IBoardModel, columns: number, capacity: number) {
        this.model = model;
        this.columns = columns;
        this.visited = new Uint8Array(model.getCells().length);
        this.matches = new Array<number>(capacity).fill(0);
        this.moves = new Array<CellMove>(capacity);
        for (let i = 0; i < capacity; i++) {
            this.moves[i] = { from: 0, to: 0 };
        }
    }

    public processClick(index: number): TurnResult {
        const matchCount = this.findGroup(index, this.matches);

        if (matchCount < 2) {
            return { valid: false, removedIndices: this.matches, matchCount: 0, moves: this.moves, moveCount: 0 };
        }

        this.model.removeCells(this.matches, matchCount);

        const moveCount = this.applyGravity();

        // Заполнение
        return { valid: true, removedIndices: this.matches, matchCount, moves: this.moves, moveCount };
    }

    private applyGravity(): number {
        const cells = this.model.getCells();
        let moveCount = 0;

        for (let column = 0; column < this.columns; column++) {
            let target = column;
            for (let source = column; source < cells.length; source += this.columns) {
                if (cells[source] < 0) {
                    continue;
                }

                if (source !== target) {
                    this.model.moveCell(source, target);
                    const move = this.moves[moveCount++];
                    move.from = source;
                    move.to = target;
                }
                target += this.columns;
            }
        }
        return moveCount;
    }

    /** Заполняет заранее выделенный массив и возвращает количество найденных индексов. */
    public findGroup(index: number, matches: number[]): number {
        const cells = this.model.getCells();

        if (!Number.isInteger(index) || index < 0 || index >= cells.length || cells[index] < 0) {
            return 0;
        }

        const color = cells[index];
        let matchCount = 0;
        if (this.visited.length !== cells.length) {
            this.visited = new Uint8Array(cells.length);
        } else {
            this.visited.fill(0);
        }
        const visited = this.visited;

        const visit = (i: number): void => {
            if (i < 0 || i >= cells.length ||
                visited[i] || cells[i] !== color)
                return;

            visited[i] = 1;
            matches[matchCount++] = i;

            const x = i % this.columns;

            if (x > 0) visit(i - 1);
            if (x < this.columns - 1) visit(i + 1);

            visit(i - this.columns);
            visit(i + this.columns);
        };

        visit(index);

        return matchCount >= 2 ? matchCount : 0;
    }
}
