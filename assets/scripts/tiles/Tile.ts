const { ccclass, property } = cc._decorator;

@ccclass
export default class Tile extends cc.Component {
    @property(cc.Sprite)
    public sprite: cc.Sprite = null;

    public setSprite(spriteFrame: cc.SpriteFrame): void {
        this.sprite.spriteFrame = spriteFrame;
    }

    public setSize(size: cc.Size): void {
        this.sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        this.sprite.node.setContentSize(size);
    }
}
