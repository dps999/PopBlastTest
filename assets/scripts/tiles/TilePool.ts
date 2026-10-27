import Tile from "./Tile";

export class TilePool {
    private nodePool: cc.NodePool = new cc.NodePool();
    private readonly prefab: cc.Prefab;

    constructor(prefab: cc.Prefab) {
        this.prefab = prefab;
    }

    public get(): Tile {
        const node = this.nodePool.get() || cc.instantiate(this.prefab);
        return node.getComponent(Tile);
    }

    public release(tile: Tile): void {
        this.nodePool.put(tile.node);
    }
}
