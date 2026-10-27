import type { IBoardEngine, TurnResult } from "./IBoardEngine";
import type { IBoardModel } from "./IBoardModel";

/** Доменный сервис игровых правил поля. */
export class BoardEngine implements IBoardEngine {
    private readonly model: IBoardModel;
    private readonly columns: number;

    private visited: Uint8Array;

    constructor(model: IBoardModel, columns: number) {
        this.model = model;
        this.columns = columns;
        this.visited = new Uint8Array(model.getCells().length);
    }

    public processClick(index: number): TurnResult {
        const matches = this.findGroup(index);

        if (matches.length < 2) {
            return { valid: false, steps: [] };
        }

        // Удаление
        // Гравитация
        // Заполнение
        // Формирование TurnResult
        return { valid: true, steps: [] };
    }

    public findGroup(index: number): number[] {
        const cells = this.model.getCells();

        if (!Number.isInteger(index) || index < 0 || index >= cells.length || cells[index] < 0) {
            return [];
        }

        const color = cells[index];
        const matches: number[] = [];
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
            matches.push(i);

            const x = i % this.columns;

            if (x > 0) visit(i - 1);
            if (x < this.columns - 1) visit(i + 1);

            visit(i - this.columns);
            visit(i + this.columns);
        };

        visit(index);

        return matches.length >= 2 ? matches : [];
    }
}
