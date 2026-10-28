import { BoardEffectStrategy, ColumnEffectStrategy, RadiusEffectStrategy, RowEffectStrategy, ThresholdCreationStrategy, TileKind } from "./SuperTileStrategies";
import type { ISuperTileCreationStrategy, ISuperTileEffectStrategy, SuperTileRule } from "./SuperTileStrategies";

export interface SuperTileServices {
    creation: ISuperTileCreationStrategy;
    effects: ISuperTileEffectStrategy[];
}

/** Точка регистрации типов. Стратегии создаются один раз для поля. */
export class SuperTileFactory {
    public static create(rules: SuperTileRule[], radius: number): SuperTileServices {
        const effects: ISuperTileEffectStrategy[] = [];
        effects[TileKind.Row] = new RowEffectStrategy();
        effects[TileKind.Column] = new ColumnEffectStrategy();
        effects[TileKind.Radius] = new RadiusEffectStrategy(radius);
        effects[TileKind.Board] = new BoardEffectStrategy();
        const creation = new ThresholdCreationStrategy(rules);
        for (let i = 0; i < rules.length; i++) {
            if (!effects[rules[i].kind]) {
                throw new Error("No registered effect for super tile kind " + rules[i].kind);
            }
        }
        return { creation, effects };
    }
}
