import { BombBoosterStrategy } from "./BombBoosterStrategy";
import { TeleportBoosterStrategy } from "./TeleportBoosterStrategy";
import type { BoosterDefinition } from "./BoosterContracts";

/** Добавление буста: реализация стратегии и запись в определениях. Порядок совпадает с кнопками. */
export class BoosterFactory {
    public static createDefinitions(columns: number, capacity: number, radius: number,
        bombCount: number, teleportCount: number): BoosterDefinition[] {
        return [
            { effect: new BombBoosterStrategy(columns, capacity, radius), initialCount: bombCount },
            { effect: new TeleportBoosterStrategy(), initialCount: teleportCount }
        ];
    }
}
