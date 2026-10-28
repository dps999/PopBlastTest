import type { TurnResult } from "../board/IBoardEngine";
import type { IBoosterBoardActions, IBoosterEffectStrategy, BoosterContext } from "./BoosterContracts";

const { ccclass, disallowMultiple } = cc._decorator;

/** Базовый компонент стратегий; префаб стратегии не содержит визуальных узлов. */
@ccclass
@disallowMultiple
export default abstract class BoosterEffectStrategy extends cc.Component implements IBoosterEffectStrategy {
    public abstract readonly targetCount: number;

    public validate(): void {
        if (!Number.isInteger(this.targetCount) || this.targetCount < 1) {
            throw new Error("Booster strategy requires a positive integer target count.");
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
