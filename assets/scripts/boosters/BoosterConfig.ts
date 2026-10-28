const { ccclass, property, disallowMultiple } = cc._decorator;

/** Параметры экземпляра бустера; иконка задаётся данными и не требует Sprite-компонента. */
@ccclass
@disallowMultiple
export default class BoosterConfig extends cc.Component {
    @property({ type: cc.Integer, min: 0, tooltip: "Количество зарядов в начале уровня." })
    public initialCount: number = 3;

    @property(cc.SpriteFrame)
    public icon: cc.SpriteFrame = null;

    public validate(): void {
        if (!Number.isInteger(this.initialCount) || this.initialCount < 0) {
            throw new Error("Booster count must be a non-negative integer.");
        }
    }
}
