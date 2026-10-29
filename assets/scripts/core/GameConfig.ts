const { ccclass, property } = cc._decorator;

@ccclass("GameConfig")
export class GameConfig {
    @property({ type: cc.Integer, min: 1 })
    public boardRows: number = 8;

    @property({ type: cc.Integer, min: 1 })
    public boardColumns: number = 8;
    @property({ type: cc.Integer, min: 2, max: 5, tooltip: "Количество цветов уровня: используются первые спрайты из colorSprites." })
    public colorCount: number = 5;

    @property({ type: [cc.Color], tooltip: "RGB частиц для каждого colorSprites в том же порядке: синий, зелёный, фиолетовый, красный, жёлтый. Начальная прозрачность задаётся в TileExplosion, конечная альфа всегда 255." })
    public particleColors: cc.Color[] = [
        cc.color(55, 145, 255),
        cc.color(80, 210, 45),
        cc.color(190, 65, 235),
        cc.color(245, 60, 60),
        cc.color(255, 210, 40)
    ];

    @property({ type: cc.Integer, min: 1, tooltip: "Начальное количество ходов." })
    public initialMoves: number = 20;

    @property({ type: cc.Integer, min: 1, tooltip: "Количество очков для победы." })
    public targetScore: number = 500;

    @property({ type: cc.Integer, min: 1, tooltip: "Очки за одну удалённую клетку." })
    public pointsPerTile: number = 10;
}
