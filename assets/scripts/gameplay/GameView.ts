import type { IGameState, IGameView } from "./GameContracts";
import GameOverPopupView from "./GameOverPopupView";
import HudLayout from "./HudLayout";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GameView extends cc.Component implements IGameView {
    @property(cc.Label)
    private scoreLabel: cc.Label = null;

    @property(cc.Label)
    private movesLabel: cc.Label = null;

    @property(GameOverPopupView)
    private lostPopup: GameOverPopupView = null;

    @property(GameOverPopupView)
    private wonPopup: GameOverPopupView = null;

    private hudLayout: HudLayout = null;

    protected onLoad(): void {
        this.hudLayout = new HudLayout(this.node);
        this.hudLayout.enable();
    }

    protected start(): void {
        this.scheduleOnce(this.refreshHudLayout, 0);
    }

    protected onDestroy(): void {
        if (this.hudLayout) {
            this.hudLayout.dispose();
            this.hudLayout = null;
        }
    }

    private refreshHudLayout(): void {
        if (this.hudLayout) {
            this.hudLayout.refresh();
        }
    }

    public render(state: IGameState): void {
        if (!this.scoreLabel || !this.movesLabel) {
            throw new Error("GameView requires score and moves Label references.");
        }
        this.scoreLabel.string = state.getScore().toString() + "/" + state.getTargetScore().toString();
        this.movesLabel.string = state.getMovesLeft().toString();
    }

    public showResult(won: boolean, state: IGameState): void {
        const popup = won ? this.wonPopup : this.lostPopup;
        if (!popup) {
            throw new Error("GameView requires both level result popup references.");
        }
        popup.show(state.getScore(), state.getTargetScore(), state.getMovesLeft());
    }
}
