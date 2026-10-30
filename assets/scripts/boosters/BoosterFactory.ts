import BoosterConfig from "./BoosterConfig";
import BoosterEffect from "./BoosterEffect";
import type { BoosterDefinition } from "./BoosterContracts";

/** Читает конфиг и эффект каждого бустера из prefab.data без создания узлов. */
export class BoosterFactory {
    public static createDefinitions(prefabs: cc.Prefab[]): BoosterDefinition[] {
        const definitions = new Array<BoosterDefinition>(prefabs.length);
        for (let i = 0; i < prefabs.length; i++) {
            const prefab = prefabs[i];
            if (!prefab || !prefab.data) {
                throw new Error("Missing booster prefab.");
            }
            const configs = prefab.data.getComponents(BoosterConfig);
            const effects = prefab.data.getComponents(BoosterEffect);
            if (configs.length !== 1 || effects.length !== 1) {
                throw new Error("Booster prefab requires exactly one BoosterConfig and one BoosterEffect component.");
            }
            if (prefab.data.getComponentsInChildren(cc.Sprite).length !== 0) {
                throw new Error("Booster definition prefabs must not contain a Sprite renderer.");
            }
            const config = configs[0];
            const effect = effects[0];
            config.validate();
            effect.validate();
            for (let j = 0; j < i; j++) {
                if (definitions[j].effect === effect) {
                throw new Error("Duplicate booster effect prefab.");
                }
            }
            definitions[i] = { effect, initialCount: config.initialCount, icon: config.icon };
        }
        return definitions;
    }
}
