const { ccclass, property } = cc._decorator;

@ccclass
export default class Tile extends cc.Component {
    @property(cc.Sprite)
    public sprite: cc.Sprite = null;

    public setSprite(spriteFrame: cc.SpriteFrame): void {
        this.sprite.spriteFrame = spriteFrame;
    }

    public setSize(size: cc.Size): void {
        const originalSize = this.sprite.spriteFrame.getOriginalSize();
        const scale = Math.min(
            size.width / originalSize.width,
            size.height / originalSize.height
        );

        this.sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        this.sprite.node.setContentSize(
            originalSize.width * scale,
            originalSize.height * scale
        );
    }
}
