import { BoardEffectType } from "../core/BoardEffectType";

export interface EffectContext {
    columns: number;
    capacity: number;
}

/** Реализуется компонентом стратегии на корне префаба. */
export interface ISuperTileEffect {
    readonly minimumGroupSize: number;
    readonly spriteFrame: cc.SpriteFrame;
    readonly destructionParticles?: cc.Prefab;
    readonly activationEffectType: BoardEffectType;
    readonly activationEffectPrefab: cc.Prefab;
    collectTargets(originIndex: number, context: EffectContext, targets: number[]): number;
}

export interface ISuperTileCreation {
    readonly colorCount: number;
    selectTile(groupSize: number): number;
    getStrategy(tileValue: number): ISuperTileEffect;
    getActivationEffectPrefab(): cc.Prefab;
}

export class ThresholdCreation implements ISuperTileCreation {
    public readonly colorCount: number;
    private readonly strategies: ISuperTileEffect[];
    private readonly activationEffectPrefab: cc.Prefab;

    constructor(strategies: ISuperTileEffect[], colorCount: number) {
        this.colorCount = colorCount;
        this.strategies = strategies.slice();
        let activationEffectPrefab: cc.Prefab = null;
        for (let i = 0; i < strategies.length; i++) {
            if (!Number.isInteger(strategies[i].minimumGroupSize) || strategies[i].minimumGroupSize < 2) {
                throw new Error("Super tile minimum group size must be an integer >= 2.");
            }
            if (strategies[i].activationEffectType !== BoardEffectType.None) {
                if (!strategies[i].activationEffectPrefab) {
                    throw new Error("Animated super tiles require an activation effect prefab.");
                }
                if (activationEffectPrefab && activationEffectPrefab !== strategies[i].activationEffectPrefab) {
                    throw new Error("Animated super tiles must share one activation effect prefab.");
                }
                activationEffectPrefab = strategies[i].activationEffectPrefab;
            }
        }
        this.activationEffectPrefab = activationEffectPrefab;
    }

    /** Максимальный подходящий порог; равные варианты выбираются равновероятно. */
    public selectTile(groupSize: number): number {
        let threshold = -1;
        let candidateCount = 0;
        for (let i = 0; i < this.strategies.length; i++) {
            const minimum = this.strategies[i].minimumGroupSize;
            if (minimum > groupSize || minimum < threshold) {
                continue;
            }
            if (minimum > threshold) {
                threshold = minimum;
                candidateCount = 0;
            }
            candidateCount++;
        }
        if (candidateCount === 0) {
            return -1;
        }
        let choice = candidateCount === 1 ? 0 : Math.floor(Math.random() * candidateCount);
        for (let i = 0; i < this.strategies.length; i++) {
            if (this.strategies[i].minimumGroupSize === threshold) {
                if (choice === 0) {
                    return this.colorCount + i;
                }
                choice--;
            }
        }
        return -1;
    }

    public getStrategy(tileValue: number): ISuperTileEffect {
        return this.strategies[tileValue - this.colorCount] || null;
    }

    public getActivationEffectPrefab(): cc.Prefab {
        return this.activationEffectPrefab;
    }
}
