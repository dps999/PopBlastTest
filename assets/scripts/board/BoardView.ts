import type { IInitializable } from "../core/GameFactory";
import Tile from "../tiles/Tile";
import { TilePool } from "../tiles/TilePool";
import type { GameConfig } from "../core/GameConfig";
import type { IBoardView } from "./IBoardView";
import type { CellMove } from "./IBoardEngine";
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
    private tileSpacing: cc.Size = cc.size(4, -25);

    @property({ min: 0, tooltip: "Длительность падения тайлов в секундах." })
    private fallDuration: number = 0.25;

    private tilePool: TilePool;
    private colorSprites: cc.SpriteFrame[];
    private config: GameConfig;
    private inputService: BoardInputService;
    private tiles: Tile[] = [];
    private tileSize: cc.Size = cc.size(0, 0);
    private lastTileSpacingX: number = NaN;
    private lastTileSpacingY: number = NaN;
    private fallingTweens: cc.Tween[] = [];
    private fallingCount: number = 0;

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

    public moveTiles(moves: CellMove[], count: number): void {
        if (this.fallingTweens.length > 0) {
            this.refreshLayout();
        }
        if (count === 0) {
            return;
        }

        this.inputService.setEnabled(false);
        this.fallingCount = count;
        for (let i = 0; i < count; i++) {
            const move = moves[i];
            const tile = this.tiles[move.from];
            this.tiles[move.from] = null;
            this.tiles[move.to] = tile;
            this.inputService.bind(tile.sprite.node, move.to);

            const tween = cc.tween(tile.node)
                .to(this.fallDuration, { position: this.getTilePosition(move.to) }, { easing: "quadIn" })
                .call(this.onFallComplete, this);
            this.fallingTweens.push(tween);
            tween.start();
        }
    }

    private onFallComplete(): void {
        this.fallingCount--;
        if (this.fallingCount === 0) {
            this.fallingTweens.length = 0;
            this.inputService.setEnabled(true);
        }
    }

    private stopFalling(): void {
        for (const tween of this.fallingTweens) {
            tween.stop();
        }
        this.fallingTweens.length = 0;
        this.fallingCount = 0;
        if (this.inputService) {
            this.inputService.setEnabled(true);
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
        this.stopFalling();
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
        tile.setSize(this.tileSize);
        tile.node.parent = this.initialPoint;
        tile.node.setPosition(this.getTilePosition(index));
    }

    private getTilePosition(index: number): cc.Vec3 {
        const column = index % this.config.boardColumns;
        const row = Math.floor(index / this.config.boardColumns);
        return cc.v3(
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
        this.stopFalling();
        if (this.inputService) {
            this.inputService.dispose();
        }
    }
}
