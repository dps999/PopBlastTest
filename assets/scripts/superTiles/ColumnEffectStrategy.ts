import SuperTileStrategy from "./SuperTileStrategy";
import type { EffectContext } from "./SuperTileStrategies";

const { ccclass } = cc._decorator;

@ccclass
export default class ColumnEffectStrategy extends SuperTileStrategy {
    public collectTargets(originIndex: number, context: EffectContext, targets: number[]): number {
        let count = 0;
        for (let i = originIndex % context.columns; i < context.capacity; i += context.columns) {
            targets[count++] = i;
        }
        return count;
    }
}
