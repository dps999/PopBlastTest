import SuperTile from "./SuperTile";
import { BoardEffectType } from "../core/BoardEffectType";
import type { EffectContext } from "./SuperTileStrategies";

const { ccclass } = cc._decorator;

@ccclass
export default class RowEffect extends SuperTile {
    public readonly activationEffectType: BoardEffectType = BoardEffectType.HorizontalRocket;

    public collectTargets(originIndex: number, context: EffectContext, targets: number[]): number {
        const start = originIndex - originIndex % context.columns;
        for (let i = 0; i < context.columns; i++) {
            targets[i] = start + i;
        }
        return context.columns;
    }
}
