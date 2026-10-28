import type { IBoardController, IBoardInputHandler } from "../board/IBoardController";
import type { IBoosterInputController } from "../boosters/BoosterContracts";
import type { IGameTurnListener } from "./GameContracts";

/** Координирует ввод игрового хода и действия активного бустера. */
export class GameInputController implements IBoardInputHandler {
    private readonly board: IBoardController;
    private readonly boosters: IBoosterInputController;
    private readonly turnListener: IGameTurnListener;

    constructor(board: IBoardController, boosters: IBoosterInputController, turnListener: IGameTurnListener) {
        this.board = board;
        this.boosters = boosters;
        this.turnListener = turnListener;
    }

    public init(): void {
        this.board.init();
        this.boosters.init();
    }

    public onCellClicked(index: number): void {
        const result = this.boosters.isActive()
            ? this.boosters.processCell(index)
            : this.board.processClick(index);
        if (result && result.valid) {
            this.turnListener.onTurnResolved(result.removedCount);
        }
        this.board.applyTurnResult(result);
    }
}
