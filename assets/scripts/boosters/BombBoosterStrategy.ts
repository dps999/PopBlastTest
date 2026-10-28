import type { TurnResult } from "../board/IBoardEngine";
import type { IBoosterBoardActions, BoosterContext } from "./BoosterContracts";
import BoosterEffectStrategy from "./BoosterEffectStrategy";

const { ccclass, property } = cc._decorator;

@ccclass
export default class BombBoosterStrategy extends BoosterEffectStrategy {
    public readonly targetCount: number = 1;

    @property({ type: cc.Integer, min: 1 })
    public radius: number = 1;

    public validate(): void {
        super.validate();
        if (!Number.isInteger(this.radius) || this.radius < 1) {
            throw new Error("Booster bomb radius must be a positive integer.");
        }
    }

    public execute(selected: number[], board: IBoosterBoardActions, context: BoosterContext): TurnResult {
        const column = selected[0] % context.columns;
        const row = Math.floor(selected[0] / context.columns);
        const firstRow = Math.max(0, row - this.radius);
        const lastRow = Math.min(context.capacity / context.columns - 1, row + this.radius);
        const firstColumn = Math.max(0, column - this.radius);
        const lastColumn = Math.min(context.columns - 1, column + this.radius);
        let count = 0;
        for (let y = firstRow; y <= lastRow; y++) {
            for (let x = firstColumn; x <= lastColumn; x++) {
                context.targets[count++] = y * context.columns + x;
            }
        }
        return board.processRemoval(context.targets, count);
    }
}
