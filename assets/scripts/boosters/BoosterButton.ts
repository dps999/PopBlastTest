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

    public moveQuantityLabelToLayer(layer: cc.Node): void {
        if (!this.quantityLabel) {
            return;
        }

        const labelNode = this.quantityLabel.node;
        const layoutNode = this.node.parent;
        if (!layer || !layoutNode || layer.parent !== layoutNode.parent || labelNode.parent === layer || layer.scaleX === 0 || layer.scaleY === 0) {
            return;
        }

        const localX = (layoutNode.x + layoutNode.scaleX * (this.node.x + this.node.scaleX * labelNode.x) - layer.x) / layer.scaleX;
        const localY = (layoutNode.y + layoutNode.scaleY * (this.node.y + this.node.scaleY * labelNode.y) - layer.y) / layer.scaleY;
        const scaleX = layoutNode.scaleX * this.node.scaleX * labelNode.scaleX / layer.scaleX;
        const scaleY = layoutNode.scaleY * this.node.scaleY * labelNode.scaleY / layer.scaleY;

        labelNode.parent = layer;
        labelNode.setPosition(localX, localY);
        labelNode.setScale(scaleX, scaleY);
    }

    public render(count: number, active: boolean, enabled: boolean): void {
        if (this.displayedCount !== count) {
            this.quantityLabel.string = String(count);
            this.displayedCount = count;
        }
        this.button.interactable = enabled;
        const color = !enabled ? this.disabledColor : active ? this.activeColor : this.normalColor;
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
