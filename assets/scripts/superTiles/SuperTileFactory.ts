import SuperTile from "./SuperTile";
import {ISuperTileEffect, ThresholdCreation} from "./SuperTileStrategies";

/** Читает стратегии из префабов без создания узлов и пулов. */
export class SuperTileFactory {
    public readonly creation: ThresholdCreation;

    constructor(prefabs: cc.Prefab[], colorCount: number) {
        const strategies = new Array<ISuperTileEffect>(prefabs.length);
        for (let i = 0; i < prefabs.length; i++) {
            const prefab = prefabs[i];
            if (!prefab || !prefab.data) {
                throw new Error("Missing strategy prefab.");
            }
            const components = prefab.data.getComponents(SuperTile);
            if (components.length !== 1) {
                throw new Error("Strategy prefab requires exactly one SuperTile component.");
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
        this.creation = new ThresholdCreation(strategies, colorCount);
    }
}
