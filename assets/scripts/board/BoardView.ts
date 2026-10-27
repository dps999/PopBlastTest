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
    @property({ type: cc.Sprite, tooltip: "Фон поля; размер его узла задаёт размеры ячеек." })
    private boardBackground: cc.Sprite = null;

    @property({ type: cc.Node, tooltip: "Центр нижнего левого тайла (ряд 0, столбец 0)." })
    private initialPoint: cc.Node = null;

    @property({ tooltip: "Зазор между тайлами по X и Y." })
    private tileSpacing: cc.Size = cc.size(4, 4);

    private tilePool: TilePool;
    private colorSprites: cc.SpriteFrame[];
    private config: GameConfig;
    private inputService: BoardInputService;
    private tiles: Tile[] = [];
    private tileSize: cc.Size = cc.size(0, 0);
    private lastTileSpacingX: number = NaN;
    private lastTileSpacingY: number = NaN;

    public init(dependencies: BoardViewDependencies): void {
        this.tilePool = dependencies.tilePool;
        this.colorSprites = dependencies.colorSprites;
        this.config = dependencies.config;
        this.inputService = dependencies.inputService;
        this.refreshLayout();
    }

    public initRender(cells: number[]): void {
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] === -1) {
                cells[i] = Math.floor(Math.random() * this.colorSprites.length);
            }
            const tile = this.tilePool.get();
            tile.setSprite(this.colorSprites[cells[i]]);
            this.layoutTile(tile, i);
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

    private getTileSizeFromBackground(): cc.Size {
        const backgroundNode = this.boardBackground.node;
        const spriteFrame = this.boardBackground.spriteFrame;
        const scaleX = backgroundNode.scaleX / this.initialPoint.scaleX;
        const scaleY = backgroundNode.scaleY / this.initialPoint.scaleY;
        const fieldWidth = backgroundNode.width - spriteFrame.insetLeft - spriteFrame.insetRight;
        const fieldHeight = backgroundNode.height - spriteFrame.insetTop - spriteFrame.insetBottom;
        const originalTileSize = this.colorSprites[0].getOriginalSize();
        const availableWidth = fieldWidth * scaleX - this.tileSpacing.width * (this.config.boardColumns - 1);
        const availableHeight = fieldHeight * scaleY - this.tileSpacing.height * (this.config.boardRows - 1);
        const tileScale = Math.max(0, Math.min(
            availableWidth / (originalTileSize.width * this.config.boardColumns),
            availableHeight / (originalTileSize.height * this.config.boardRows)
        ));

        return cc.size(
            originalTileSize.width * tileScale,
            originalTileSize.height * tileScale
        );
    }

    private refreshLayout(): void {
        this.tileSize = this.getTileSizeFromBackground();
        this.alignInitialPointToBackground();

        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];
            if (tile) {
                this.layoutTile(tile, i);
            }
        }

        this.lastTileSpacingX = this.tileSpacing.width;
        this.lastTileSpacingY = this.tileSpacing.height;
    }

    private layoutTile(tile: Tile, index: number): void {
        const column = index % this.config.boardColumns;
        const row = Math.floor(index / this.config.boardColumns);
        tile.setSize(this.tileSize);
        tile.node.parent = this.initialPoint;
        tile.node.setPosition(
            column * (this.tileSize.width + this.tileSpacing.width),
            row * (this.tileSize.height + this.tileSpacing.height)
        );
    }

    private alignInitialPointToBackground(): void {
        const backgroundNode = this.boardBackground.node;
        const spriteFrame = this.boardBackground.spriteFrame;
        const parent = this.initialPoint.parent;
        const fieldLeft = backgroundNode.x
            - backgroundNode.width * backgroundNode.scaleX * backgroundNode.anchorX
            + spriteFrame.insetLeft * backgroundNode.scaleX;
        const fieldBottom = backgroundNode.y
            - backgroundNode.height * backgroundNode.scaleY * backgroundNode.anchorY
            + spriteFrame.insetBottom * backgroundNode.scaleY;
        const fieldWidth = (backgroundNode.width - spriteFrame.insetLeft - spriteFrame.insetRight)
            * backgroundNode.scaleX;
        const fieldHeight = (backgroundNode.height - spriteFrame.insetTop - spriteFrame.insetBottom)
            * backgroundNode.scaleY;
        const gridWidth = (
            this.tileSize.width * this.config.boardColumns
            + this.tileSpacing.width * (this.config.boardColumns - 1)
        ) * this.initialPoint.scaleX;
        const gridHeight = (
            this.tileSize.height * this.config.boardRows
            + this.tileSpacing.height * (this.config.boardRows - 1)
        ) * this.initialPoint.scaleY;
        const firstTileX = fieldLeft + (fieldWidth - gridWidth) / 2
            + this.tileSize.width * this.initialPoint.scaleX / 2;
        const firstTileY = fieldBottom + (fieldHeight - gridHeight) / 2
            + this.tileSize.height * this.initialPoint.scaleY / 2;
        const widget = this.initialPoint.getComponent(cc.Widget);

        if (widget) {
            widget.left = firstTileX + parent.width * parent.anchorX;
            widget.bottom = firstTileY + parent.height * parent.anchorY;
            widget.updateAlignment();
            return;
        }

        this.initialPoint.setPosition(firstTileX, firstTileY);
    }

    protected update(_deltaTime: number): void {
        if (!this.config
            || (this.tileSpacing.width === this.lastTileSpacingX
                && this.tileSpacing.height === this.lastTileSpacingY)) {
            return;
        }

        this.refreshLayout();
    }

    protected onDestroy(): void {
        if (this.inputService) {
            this.inputService.dispose();
        }
    }
}
