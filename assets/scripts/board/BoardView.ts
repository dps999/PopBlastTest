import type { IInitializable } from "../core/GameFactory";
import Tile from "../tiles/Tile";
import { TilePool } from "../tiles/TilePool";
import type { GameConfig } from "../core/GameConfig";
import {IBoardView} from "./IBoardView";

export interface BoardViewDependencies {
    tilePool: TilePool;
    colorSprites: cc.SpriteFrame[];
    config: GameConfig;
}

const { ccclass, property } = cc._decorator;

@ccclass
export default class BoardView extends cc.Component implements IBoardView, IInitializable<BoardViewDependencies> {
    @property({ type: cc.Node, tooltip: "Центр нижнего левого тайла (ряд 0, столбец 0)." })
    private initialPoint: cc.Node = null;

    @property({ tooltip: "Шаг между центрами тайлов по X и Y." })
    private cellSize: cc.Size = cc.size(100, 112);

    private tilePool: TilePool;
    private colorSprites: cc.SpriteFrame[];
    private config: GameConfig;
    private tiles: Tile[] = [];

    public init(dependencies: BoardViewDependencies): void {
        this.tilePool = dependencies.tilePool;
        this.colorSprites = dependencies.colorSprites;
        this.config = dependencies.config;
    }

    public initRender(cells: number[]): void {
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] === -1) {
                cells[i] = Math.floor(Math.random() * this.colorSprites.length);
            }
            const tile = this.tilePool.get();
            tile.setSprite(this.colorSprites[cells[i]]);
            const column = i % this.config.boardColumns;
            const row = Math.floor(i / this.config.boardColumns);
            tile.node.parent = this.initialPoint;
            tile.node.setPosition(column * this.cellSize.width, row * this.cellSize.height);
            this.tiles.push(tile);
        }
    }
}
