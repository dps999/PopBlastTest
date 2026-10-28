const { ccclass, property } = cc._decorator;

@ccclass("SuperTileRuleConfig")
export class SuperTileRuleConfig {
    @property({ type: cc.Integer, min: 1, tooltip: "1: ряд, 2: столбец, 3: радиус, 4: поле." })
    public kind: number = 1;

    @property({ type: cc.Integer, min: 2, tooltip: "Пороги идут по возрастанию; при равенстве побеждает последнее правило." })
    public minimumGroupSize: number = 8;

    constructor(kind: number = 1, minimumGroupSize: number = 8) {
        this.kind = kind;
        this.minimumGroupSize = minimumGroupSize;
    }
}

@ccclass("GameConfig")
export class GameConfig {
    @property([SuperTileRuleConfig])
    public superTileRules: SuperTileRuleConfig[] = [
        new SuperTileRuleConfig(1, 8), new SuperTileRuleConfig(2, 10),
        new SuperTileRuleConfig(3, 12), new SuperTileRuleConfig(4, 15)
    ];

    @property({ type: cc.Integer, min: 1 })
    public superTileRadius: number = 1;

    @property({ type: cc.Integer, min: 1 })
    public boardRows: number = 8;

    @property({ type: cc.Integer, min: 1 })
    public boardColumns: number = 8;
    @property({ type: cc.Integer, min: 2, max: 5, tooltip: "Количество цветов уровня: используются первые спрайты из colorSprites." })
    public colorCount: number = 5;
}
