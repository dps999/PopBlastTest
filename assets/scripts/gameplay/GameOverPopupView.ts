const { ccclass, property } = cc._decorator;

/** Представление окна; решения о продолжении и выходе принимает внешний контроллер. */
@ccclass
export default class GameOverPopupView extends cc.Component {
    @property(cc.Label)
    private scoreLabel: cc.Label = null;

    @property([cc.Component.EventHandler])
    private continueEvents: cc.Component.EventHandler[] = [];

    public show(score: number, targetScore: number, moves: number): void {
        this.scoreLabel.string = score.toString() + "/" + targetScore.toString();
        this.node.active = true;
        const animation = this.getComponent(cc.Animation);
        if (animation && animation.defaultClip) {
            animation.play(animation.defaultClip.name, 0);
            animation.sample(animation.defaultClip.name);
        }
    }

    public hide(): void {
        this.node.active = false;
    }

    public onContinueClicked(): void {
        cc.Component.EventHandler.emitEvents(this.continueEvents);
    }

}
