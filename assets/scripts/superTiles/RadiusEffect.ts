import SuperTile from "./SuperTile";
import type { EffectContext } from "./SuperTileStrategies";

const { ccclass, property } = cc._decorator;

@ccclass
export default class RadiusEffect extends SuperTile {
    @property({ type: cc.Integer, min: 1 })
    public radius: number = 1;

    public validate(): void {
        super.validate();
        if (!Number.isInteger(this.radius) || this.radius < 1) {
            throw new Error("Super tile radius must be a positive integer.");
        }
    }

    public collectTargets(originIndex: number, context: EffectContext, targets: number[]): number {
        const column = originIndex % context.columns;
        const row = Math.floor(originIndex / context.columns);
        const firstRow = Math.max(0, row - this.radius);
        const lastRow = Math.min(context.capacity / context.columns - 1, row + this.radius);
        const firstColumn = Math.max(0, column - this.radius);
        const lastColumn = Math.min(context.columns - 1, column + this.radius);
        let count = 0;
        for (let y = firstRow; y <= lastRow; y++) {
            for (let x = firstColumn; x <= lastColumn; x++) {
                targets[count++] = y * context.columns + x;
            }
        }
        return count;
    }
}
