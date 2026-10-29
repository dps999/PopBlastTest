import type { EffectContext, ISuperTileEffectStrategy } from "./SuperTileStrategies";

const { ccclass, property, disallowMultiple } = cc._decorator;

/** Общая стратегия для всех тайлов данного префаба. Не хранит состояние хода. */
@ccclass
@disallowMultiple
export default abstract class SuperTileStrategy extends cc.Component implements ISuperTileEffectStrategy {
    @property({ type: cc.Integer, min: 2, tooltip: "Минимальный размер обычной группы для создания усилителя." })
    public minimumGroupSize: number = 8;

    @property(cc.SpriteFrame)
    public spriteFrame: cc.SpriteFrame = null;

    @property(cc.Prefab)
    public destructionParticles: cc.Prefab = null;

    public validate(): void {
        if (!this.spriteFrame) {
            throw new Error("Strategy requires a sprite frame.");
        }
        if (!Number.isInteger(this.minimumGroupSize) || this.minimumGroupSize < 2) {
            throw new Error("Super tile minimum group size must be an integer >= 2.");
        }
    }

    public abstract collectTargets(originIndex: number, context: EffectContext, targets: number[]): number;
}
