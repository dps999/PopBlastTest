import SuperTileStrategy from "./SuperTileStrategy";
import { ThresholdCreationStrategy } from "./SuperTileStrategies";
import type { ISuperTileEffectStrategy } from "./SuperTileStrategies";

/** Читает стратегии из префабов без создания узлов и пулов. */
export class SuperTileFactory {
    public readonly creation: ThresholdCreationStrategy;

    constructor(prefabs: cc.Prefab[], colorCount: number) {
        const strategies = new Array<ISuperTileEffectStrategy>(prefabs.length);
        for (let i = 0; i < prefabs.length; i++) {
            const prefab = prefabs[i];
            if (!prefab || !prefab.data) {
                throw new Error("Missing strategy prefab.");
            }
            const components = prefab.data.getComponents(SuperTileStrategy);
            if (components.length !== 1) {
                throw new Error("Strategy prefab requires exactly one SuperTileStrategy component.");
            }
            const strategy = components[0];
            strategy.validate();
            for (let j = 0; j < i; j++) {
                if (strategies[j] === strategy) {
                    throw new Error("Duplicate strategy prefab.");
                }
            }
            strategies[i] = strategy;
        }
        this.creation = new ThresholdCreationStrategy(strategies, colorCount);
    }
}
