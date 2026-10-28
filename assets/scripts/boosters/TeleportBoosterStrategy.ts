import type { TurnResult } from "../board/IBoardEngine";
import type { IBoosterBoardActions, BoosterContext } from "./BoosterContracts";
import BoosterEffectStrategy from "./BoosterEffectStrategy";

const { ccclass } = cc._decorator;

@ccclass
export default class TeleportBoosterStrategy extends BoosterEffectStrategy {
    public readonly targetCount: number = 2;

    public execute(selected: number[], board: IBoosterBoardActions, _context: BoosterContext): TurnResult {
        return board.processSwap(selected[0], selected[1]);
    }
}
