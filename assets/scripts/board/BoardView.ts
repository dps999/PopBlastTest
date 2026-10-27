import type { IInitializable } from "../core/GameFactory";
import Tile from "../tiles/Tile";
import { TilePool } from "../tiles/TilePool";
import type { GameConfig } from "../core/GameConfig";
import type { IBoardView } from "./IBoardView";
import { BoardInputService } from "./BoardInputService";

export interface BoardViewDependencies {
    tilePool: TilePool;
    colorSprites: cc.SpriteFrame[];
    config: GameConfig;
    inputService: BoardInputService;
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
    private inputService: BoardInputService;
    private tiles: Tile[] = [];

    public init(dependencies: BoardViewDependencies): void {
        this.tilePool = dependencies.tilePool;
        this.colorSprites = dependencies.colorSprites;
        this.config = dependencies.config;
        this.inputService = dependencies.inputService;
    }

    public initRender(cells: number[]): void {
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] === -1) {
                cells[i] = Math.floor(Math.random() * this.colorSprites.length);
            }
            const tile = this.tilePool.get();
            tile.setSprite(this.colorSprites[cells[i]]);
            tile.setSize(this.cellSize);
            const column = i % this.config.boardColumns;
            const row = Math.floor(i / this.config.boardColumns);
            tile.node.parent = this.initialPoint;
            tile.node.setPosition(column * this.cellSize.width, row * this.cellSize.height);
            this.inputService.bind(tile.sprite.node, i);
            this.tiles.push(tile);
        }
    }

    public removeTiles(indices: number[]): void {
        for (const index of indices) {
            const tile = this.tiles[index];
            if (!tile) {
                continue;
            }

            this.inputService.unbind(tile.sprite.node);
            this.tilePool.release(tile);
            this.tiles[index] = null;
        }
    }

    protected onDestroy(): void {
        if (this.inputService) {
            this.inputService.dispose();
        }
    }
}
