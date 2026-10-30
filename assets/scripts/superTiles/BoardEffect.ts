import SuperTile from "./SuperTile";
import type { EffectContext } from "./SuperTileStrategies";

const { ccclass } = cc._decorator;

@ccclass
export default class BoardEffect extends SuperTile {
    public collectTargets(_originIndex: number, context: EffectContext, targets: number[]): number {
        for (let i = 0; i < context.capacity; i++) {
            targets[i] = i;
        }
        return context.capacity;
    }
}
