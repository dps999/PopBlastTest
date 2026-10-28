import type { TurnResult } from "../board/IBoardEngine";
import type { IBoosterBoardActions, IBoosterEffectStrategy } from "./BoosterContracts";

export class TeleportBoosterStrategy implements IBoosterEffectStrategy {
    public readonly targetCount: number = 2;

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

    public execute(selected: number[], board: IBoosterBoardActions): TurnResult {
        return board.processSwap(selected[0], selected[1]);
    }
}
