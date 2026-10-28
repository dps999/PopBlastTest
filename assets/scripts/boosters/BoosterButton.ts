import type { IBoosterButtonListener } from "./BoosterContracts";

const { ccclass, property, requireComponent, disallowMultiple } = cc._decorator;

@ccclass
@requireComponent(cc.Button)
@disallowMultiple
export default class BoosterButton extends cc.Component {
    @property(cc.Button)
    private button: cc.Button = null;

    @property(cc.Sprite)
    private icon: cc.Sprite = null;

    @property(cc.Label)
    private quantityLabel: cc.Label = null;

    private listener: IBoosterButtonListener = null;
    private index: number = -1;
    private displayedCount: number = -1;
    private readonly normalColor: cc.Color = cc.color(255, 255, 255);
    private readonly activeColor: cc.Color = cc.color(255, 225, 100);
    private readonly disabledColor: cc.Color = cc.color(150, 150, 150);

    public init(listener: IBoosterButtonListener, index: number, icon: cc.SpriteFrame): void {
        this.dispose();
        this.listener = listener;
        this.index = index;
        this.icon.spriteFrame = icon;
        this.node.on("click", this.onClick, this);
    }

    public render(count: number, active: boolean, enabled: boolean): void {
        if (this.displayedCount !== count) {
            this.quantityLabel.string = String(count);
            this.displayedCount = count;
        }
        this.button.interactable = enabled;
        this.node.color = !enabled ? this.disabledColor : active ? this.activeColor : this.normalColor;
    }

    public dispose(): void {
        this.node.off("click", this.onClick, this);
        this.listener = null;
    }

    private onClick(): void {
        if (this.button.interactable && this.listener) {
            this.listener.selectBooster(this.index);
        }
    }

    protected onDestroy(): void {
        this.dispose();
    }
}
