const { ccclass, property } = cc._decorator;

@ccclass("GameConfig")
export class GameConfig {
    @property({ type: cc.Integer, min: 1 })
    public boardRows: number = 8;

    @property({ type: cc.Integer, min: 1 })
    public boardColumns: number = 8;
    @property({ type: cc.Integer, min: 2, max: 5, tooltip: "Количество цветов уровня: используются первые спрайты из colorSprites." })
    public colorCount: number = 5;

    @property({ type: cc.Integer, min: 1, tooltip: "Начальное количество ходов." })
    public initialMoves: number = 20;

    @property({ type: cc.Integer, min: 1, tooltip: "Количество очков для победы." })
    public targetScore: number = 500;

    @property({ type: cc.Integer, min: 1, tooltip: "Очки за одну удалённую клетку." })
    public pointsPerTile: number = 10;
}
