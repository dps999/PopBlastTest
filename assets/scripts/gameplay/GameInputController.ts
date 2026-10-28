import type { IBoardController, IBoardInputHandler } from "../board/IBoardController";
import type { IBoosterInputController } from "../boosters/BoosterContracts";

/** Координирует ввод игрового хода и действия активного бустера. */
export class GameInputController implements IBoardInputHandler {
    private readonly board: IBoardController;
    private readonly boosters: IBoosterInputController;

    constructor(board: IBoardController, boosters: IBoosterInputController) {
        this.board = board;
        this.boosters = boosters;
    }

    public init(): void {
        this.board.init();
        this.boosters.init();
    }

    public onCellClicked(index: number): void {
        const result = this.boosters.isActive()
            ? this.boosters.processCell(index)
            : this.board.processClick(index);
        this.board.applyTurnResult(result);
    }
}
