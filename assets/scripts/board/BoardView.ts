import type { IBoardView } from "./BoardController";
import type { IInitializable } from "../core/GameFactory";
import Tile from "../tiles/Tile";
import { TilePool } from "../tiles/TilePool";

export interface BoardViewDependencies {
    tilePool: TilePool;
    colorSprites: cc.SpriteFrame[];
}

const { ccclass } = cc._decorator;

@ccclass
export default class BoardView extends cc.Component implements IBoardView, IInitializable<BoardViewDependencies> {
    private tilePool: TilePool;
    private colorSprites: cc.SpriteFrame[];
    private tiles: Tile[] = [];

    public init(dependencies: BoardViewDependencies): void {
        this.tilePool = dependencies.tilePool;
        this.colorSprites = dependencies.colorSprites;
    }

    public initRender(cells: number[]): void {
        for (const color of cells) {
            const tile = this.tilePool.get();
            tile.setSprite(this.colorSprites[color]);
            tile.node.parent = this.node;
            this.tiles.push(tile);
        }
    }
}
