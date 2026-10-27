const { ccclass, property } = cc._decorator;

@ccclass("GameConfig")
export class GameConfig {
    @property({ type: cc.Integer, min: 1 })
    public boardRows: number = 8;

    @property({ type: cc.Integer, min: 1 })
    public boardColumns: number = 8;
}
