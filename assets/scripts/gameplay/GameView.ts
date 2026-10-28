import type { IGameState, IGameView } from "./GameContracts";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GameView extends cc.Component implements IGameView {
    @property(cc.Label)
    private scoreLabel: cc.Label = null;
    public render(state: IGameState): void {
        if (!this.scoreLabel) {
            throw new Error("GameView requires a score Label reference.");
        }
        this.scoreLabel.string = state.getScore().toString();
    }
}
