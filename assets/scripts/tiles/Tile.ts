const { ccclass, property } = cc._decorator;

@ccclass
export default class Tile extends cc.Component {
    @property(cc.Sprite)
    public sprite: cc.Sprite = null;

    @property(cc.Prefab)
    public defaultDestructionParticles: cc.Prefab = null;

    private strategyDestructionParticles: cc.Prefab = null;

    public get destructionParticles(): cc.Prefab {
        return this.strategyDestructionParticles || this.defaultDestructionParticles;
    }

    public setSprite(spriteFrame: cc.SpriteFrame, destructionParticles: cc.Prefab = null): void {
        this.sprite.spriteFrame = spriteFrame;
        this.strategyDestructionParticles = destructionParticles;
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
