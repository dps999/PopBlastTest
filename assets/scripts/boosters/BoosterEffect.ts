import type { TurnResult } from "../board/IBoardEngine";
import type { IBoosterBoardActions, IBoosterEffect, BoosterContext } from "./BoosterContracts";

const { ccclass, property, disallowMultiple } = cc._decorator;

/** Базовый компонент эффекта; префаб-описание не содержит визуальных узлов. */
@ccclass
@disallowMultiple
export default abstract class BoosterEffect extends cc.Component implements IBoosterEffect {
    public abstract readonly targetCount: number;

    @property(cc.Prefab)
    public destructionParticles: cc.Prefab = null;

    public validate(): void {
        if (!Number.isInteger(this.targetCount) || this.targetCount < 1) {
            throw new Error("Booster effect requires a positive integer target count.");
        }
    }

    public canSelect(index: number, cells: number[], selected: number[], selectedCount: number): boolean {
        if (!Number.isInteger(index) || index < 0 || index >= cells.length || cells[index] < 0) {
            return false;
        }
        for (let i = 0; i < selectedCount; i++) {
            if (selected[i] === index) {
                return false;
            }
        }
        return true;
    }

    public abstract execute(selected: number[], board: IBoosterBoardActions, context: BoosterContext): TurnResult;
}
