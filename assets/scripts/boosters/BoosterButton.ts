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

    public init(listener: IBoosterButtonListener, index: number, icon: cc.SpriteFrame): void {
        this.dispose();
        this.listener = listener;
        this.index = index;
        if (!this.icon) {
            this.icon = this.findIconSprite();
        }
        if (!this.icon) {
            throw new Error("BoosterButton requires an Icon or icon_booster_bomb child with a Sprite component.");
        }
        this.icon.spriteFrame = icon;
        this.node.on("click", this.onClick, this);
    }

    private findIconSprite(): cc.Sprite {
        const iconNode = this.node.getChildByName("Icon")
            || this.node.getChildByName("icon_booster_bomb");
        return iconNode ? iconNode.getComponent(cc.Sprite) : null;
    }

    public render(count: number, active: boolean, enabled: boolean): void {
        if (this.displayedCount !== count) {
            this.quantityLabel.string = String(count);
            this.displayedCount = count;
        }
        this.button.interactable = enabled;
        const color = active ? this.activeColor : this.normalColor;
        this.node.color = color;
        this.quantityLabel.node.color = color;
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
