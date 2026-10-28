export interface EffectContext {
    columns: number;
    capacity: number;
}

/** Реализуется компонентом стратегии на корне префаба. */
export interface ISuperTileEffectStrategy {
    readonly minimumGroupSize: number;
    readonly spriteFrame: cc.SpriteFrame;
    collectTargets(originIndex: number, context: EffectContext, targets: number[]): number;
}

export interface ISuperTileCreationStrategy {
    readonly colorCount: number;
    selectTile(groupSize: number): number;
    getStrategy(tileValue: number): ISuperTileEffectStrategy;
}

export class ThresholdCreationStrategy implements ISuperTileCreationStrategy {
    public readonly colorCount: number;
    private readonly strategies: ISuperTileEffectStrategy[];

    constructor(strategies: ISuperTileEffectStrategy[], colorCount: number) {
        this.colorCount = colorCount;
        this.strategies = strategies.slice();
        for (let i = 0; i < strategies.length; i++) {
            if (!Number.isInteger(strategies[i].minimumGroupSize) || strategies[i].minimumGroupSize < 2) {
                throw new Error("Super tile minimum group size must be an integer >= 2.");
            }
        }
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

    public getStrategy(tileValue: number): ISuperTileEffectStrategy {
        return this.strategies[tileValue - this.colorCount] || null;
    }
}
