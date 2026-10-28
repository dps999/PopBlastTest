import SuperTileStrategy from "./SuperTileStrategy";
import type { EffectContext } from "./SuperTileStrategies";

const { ccclass } = cc._decorator;

@ccclass
export default class BoardEffectStrategy extends SuperTileStrategy {
    public collectTargets(_originIndex: number, context: EffectContext, targets: number[]): number {
        for (let i = 0; i < context.capacity; i++) {
            targets[i] = i;
        }
        return context.capacity;
    }
}
