import type { CellMove, IBoardEngine, TurnResult } from "./IBoardEngine";
import type { ISuperTileCreationStrategy } from "../superTiles/SuperTileStrategies";
import type { EffectContext } from "../superTiles/SuperTileStrategies";
import type { IBoardModel } from "./IBoardModel";

/** Доменный сервис игровых правил поля. */
export class BoardEngine implements IBoardEngine {
    private readonly model: IBoardModel;
    private readonly columns: number;
    private readonly moves: CellMove[];
    private readonly matches: number[];

    private readonly visited: Uint8Array;
    private readonly targets: number[];
    private readonly context: EffectContext;
    private readonly creation: ISuperTileCreationStrategy;
    private readonly result: TurnResult;


    constructor(model: IBoardModel, columns: number, capacity: number, creation?: ISuperTileCreationStrategy) {
        this.model = model;
        this.columns = columns;
        this.visited = new Uint8Array(capacity);
        this.targets = new Array<number>(capacity).fill(0);
        this.context = { columns, capacity };
        this.creation = creation;
        this.matches = new Array<number>(capacity).fill(0);
        this.moves = new Array<CellMove>(capacity);
        for (let i = 0; i < capacity; i++) {
            this.moves[i] = { from: 0, to: 0 };
        }
        this.result = {
            valid: false, removedIndices: this.matches, matchCount: 0, removedCount: 0,
            transformedIndex: -1, transformedValue: -1, swappedFirstIndex: -1, swappedSecondIndex: -1,
            moves: this.moves, moveCount: 0
        };
    }

    public processClick(index: number): TurnResult {
        const result = this.resetResult();
        const cells = this.model.getCells();
        if (!Number.isInteger(index) || index < 0 || index >= cells.length || cells[index] < 0) {
            return result;
        }
        let removedCount = 0;
        if (this.creation && cells[index] >= this.creation.colorCount) {
            removedCount = this.collectChain(index);
        } else {
            const count = this.findGroup(index, this.matches);
            if (count < 2) {
                return result;
            }
            result.matchCount = count;
            const value = this.creation ? this.creation.selectTile(count) : -1;
            for (let i = 0; i < count; i++) {
                const matched = this.matches[i];
                if (value < 0 || matched !== index) {
                    this.matches[removedCount++] = matched;
                }
            }
            if (value >= 0) {
                this.model.transformCell(index, value);
                result.transformedIndex = index;
                result.transformedValue = value;
            }
        }
        return this.finishRemoval(removedCount);
    }

    /** Удаление от внешнего эффекта не проходит через правила создания супер-тайлов. */
    public processRemoval(indices: number[], count: number): TurnResult {
        const result = this.resetResult();
        if (!Number.isInteger(count) || count < 1 || count > indices.length) {
            return result;
        }
        const cells = this.model.getCells();
        for (let i = 0; i < count; i++) {
            const index = indices[i];
            if (!Number.isInteger(index) || index < 0 || index >= cells.length) {
                return result;
            }
        }
        this.visited.fill(0);
        let removedCount = 0;
        for (let i = 0; i < count; i++) {
            const index = indices[i];
            if (cells[index] >= 0 && !this.visited[index]) {
                this.visited[index] = 1;
                this.matches[removedCount++] = index;
            }
        }
        if (removedCount === 0) {
            return result;
        }
        return this.finishRemoval(this.expandChain(removedCount));
    }

    public processSwap(first: number, second: number): TurnResult {
        const result = this.resetResult();
        const cells = this.model.getCells();
        if (!Number.isInteger(first) || !Number.isInteger(second) || first === second
            || first < 0 || second < 0 || first >= cells.length || second >= cells.length
            || cells[first] < 0 || cells[second] < 0) {
            return result;
        }
        this.model.swapCells(first, second);
        result.valid = true;
        result.swappedFirstIndex = first;
        result.swappedSecondIndex = second;
        return result;
    }

    private resetResult(): TurnResult {
        const result = this.result;
        result.valid = false;
        result.matchCount = 0;
        result.removedCount = 0;
        result.moveCount = 0;
        result.transformedIndex = -1;
        result.transformedValue = -1;
        result.swappedFirstIndex = -1;
        result.swappedSecondIndex = -1;
        return result;
    }

    private finishRemoval(count: number): TurnResult {
        this.model.removeCells(this.matches, count);
        this.result.valid = true;
        this.result.removedCount = count;
        this.result.moveCount = this.applyGravity();
        return this.result;
    }

    /** Массив удаления одновременно служит очередью: каждая клетка добавляется один раз. */
    private collectChain(index: number): number {
        this.visited.fill(0);
        this.matches[0] = index;
        this.visited[index] = 1;
        return this.expandChain(1);
    }

    private expandChain(count: number): number {
        const cells = this.model.getCells();
        for (let head = 0; head < count; head++) {
            const origin = this.matches[head];
            if (!this.creation || cells[origin] < this.creation.colorCount) {
                continue;
            }
            const effect = this.creation.getStrategy(cells[origin]);
            if (!effect) {
                throw new Error("Unregistered super tile effect.");
            }
            const targetCount = effect.collectTargets(origin, this.context, this.targets);
            for (let i = 0; i < targetCount; i++) {
                const target = this.targets[i];
                if (cells[target] >= 0 && !this.visited[target]) {
                    this.visited[target] = 1;
                    this.matches[count++] = target;
                }
            }
        }
        return count;
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

        if (this.creation && cells[index] >= this.creation.colorCount) {
            return 0;
        }
        this.visited.fill(0);
        const color = cells[index];
        matches[0] = index;
        this.visited[index] = 1;
        let count = 1;
        for (let head = 0; head < count; head++) {
            const current = matches[head];
            const column = current % this.columns;
            if (column > 0) count = this.visit(current - 1, color, matches, count);
            if (column < this.columns - 1) count = this.visit(current + 1, color, matches, count);
            count = this.visit(current - this.columns, color, matches, count);
            count = this.visit(current + this.columns, color, matches, count);
        }
        return count >= 2 ? count : 0;
    }

    private visit(index: number, color: number, matches: number[], count: number): number {
        const cells = this.model.getCells();
        if (index >= 0 && index < cells.length && !this.visited[index]
            && cells[index] === color) {
            this.visited[index] = 1;
            matches[count++] = index;
        }
        return count;
    }
}
