import SuperTile from "./SuperTile";
import { BoardEffectType } from "../core/BoardEffectType";
import type { EffectContext } from "./SuperTileStrategies";

const { ccclass } = cc._decorator;

@ccclass
export default class ColumnEffect extends SuperTile {
    public readonly activationEffectType: BoardEffectType = BoardEffectType.VerticalRocket;

    public collectTargets(originIndex: number, context: EffectContext, targets: number[]): number {
        let count = 0;
        for (let i = originIndex % context.columns; i < context.capacity; i += context.columns) {
            targets[count++] = i;
        }
        return count;
    }
}
