const { ccclass, property } = cc._decorator;

/** Представление окна; решения о продолжении и выходе принимает внешний контроллер. */
@ccclass
export default class GameOverPopupView extends cc.Component {
    @property(cc.Label)
    private scoreLabel: cc.Label = null;

    @property(cc.Label)
    private movesLabel: cc.Label = null;

    @property(cc.Label)
    private teleportQuantityLabel: cc.Label = null;

    @property(cc.Label)
    private bombQuantityLabel: cc.Label = null;

    @property([cc.Component.EventHandler])
    private continueEvents: cc.Component.EventHandler[] = [];

    @property([cc.Component.EventHandler])
    private exitEvents: cc.Component.EventHandler[] = [];

    public show(score: number, targetScore: number, moves: number, teleportCount: number, bombCount: number): void {
        this.scoreLabel.string = score.toString() + "/" + targetScore.toString();
        this.movesLabel.string = moves.toString();
        this.teleportQuantityLabel.string = teleportCount.toString();
        this.bombQuantityLabel.string = bombCount.toString();
        this.node.active = true;
    }

    public hide(): void {
        this.node.active = false;
    }

    public onContinueClicked(): void {
        cc.Component.EventHandler.emitEvents(this.continueEvents);
    }

    public onExitClicked(): void {
        this.hide();
        cc.Component.EventHandler.emitEvents(this.exitEvents);
    }
}
