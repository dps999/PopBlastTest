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

    /** Максимальный подходящий порог; при равенстве побеждает последний префаб. */
    public selectTile(groupSize: number): number {
        let selected = -1;
        let threshold = -1;
        for (let i = 0; i < this.strategies.length; i++) {
            const strategy = this.strategies[i];
            if (groupSize >= strategy.minimumGroupSize && strategy.minimumGroupSize >= threshold) {
                selected = this.colorCount + i;
                threshold = strategy.minimumGroupSize;
            }
        }
        return selected;
    }

    public getStrategy(tileValue: number): ISuperTileEffectStrategy {
        return this.strategies[tileValue - this.colorCount] || null;
    }
}
