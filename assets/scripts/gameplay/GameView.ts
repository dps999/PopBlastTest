import {GameState, IGameView} from "./GamePresenter";

const {ccclass, property} = cc._decorator;

@ccclass
export default class GameView extends cc.Component implements IGameView {
    @property(cc.Label)
    private scoreLabel: cc.Label = null;
    render(state: GameState): void {
        this.scoreLabel.string = state.getScore().toString();
    }

}