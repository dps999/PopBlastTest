import type { IInitializable } from "../core/GameFactory";
import type Tile from "../tiles/Tile";
import type { TilePool } from "../tiles/TilePool";
import type { GameConfig } from "../core/GameConfig";
import type { IBoardView } from "./IBoardView";
import type { CellMove } from "./IBoardEngine";
import type { BoardInputService } from "./BoardInputService";

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

    @property({ min: 1, max: 1.25, tooltip: "Насколько клетки заполняют внутреннюю область рамки." })
    private tileFillFactor: number = 1.12;

    @property({ min: 1, tooltip: "Скорость падения в локальных единицах поля в секунду." })
    private fallSpeed: number = 800;

    @property({ min: 0, tooltip: "Максимальная высота отскока при приземлении." })
    private landingBounceHeight: number = 6;

    @property({ min: 0.01, tooltip: "Длительность отскока при приземлении в секундах." })
    private landingBounceDuration: number = 0.16;

    private tilePool: TilePool;
    private colorSprites: cc.SpriteFrame[];
    private config: GameConfig;
    private inputService: BoardInputService;
    private tiles: Tile[] = [];
    private tileSize: cc.Size = cc.size(0, 0);
    private lastTileSpacingX: number = NaN;
    private lastTileSpacingY: number = NaN;
    private fallingTiles: Tile[] = [];
    private fallStartY: number[] = [];
    private fallTargetY: number[] = [];
    private fallElapsed: number[] = [];
    private fallDurations: number[] = [];
    private fallingCount: number = 0;
    private columnSpawnCounts: number[] = [];

    public init(dependencies: BoardViewDependencies): void {
        this.tilePool = dependencies.tilePool;
        this.colorSprites = dependencies.colorSprites;
        this.config = dependencies.config;
        this.inputService = dependencies.inputService;
        const cellCount = this.config.boardRows * this.config.boardColumns;
        this.fallingTiles = new Array<Tile>(cellCount).fill(null);
        this.fallStartY = new Array<number>(cellCount).fill(0);
        this.fallTargetY = new Array<number>(cellCount).fill(0);
        this.fallElapsed = new Array<number>(cellCount).fill(0);
        this.fallDurations = new Array<number>(cellCount).fill(0);
        this.columnSpawnCounts = new Array<number>(this.config.boardColumns).fill(0);
        this.refreshLayout();
    }

    public initRender(cells: number[]): void {
        this.tiles = new Array<Tile>(cells.length).fill(null);
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] === -1) {
                continue;
            }
            const tile = this.tilePool.get();
            tile.setSprite(this.colorSprites[cells[i]]);
            this.layoutTile(tile, i);
            this.inputService.bind(tile.sprite.node, i);
            this.tiles[i] = tile;
        }
    }

    public removeTiles(indices: number[], count: number): void {
        for (let i = 0; i < count; i++) {
            const index = indices[i];
            const tile = this.tiles[index];
            if (!tile) {
                continue;
            }

            this.inputService.unbind(tile.sprite.node);
            this.tilePool.release(tile);
            this.tiles[index] = null;
        }
    }

    public fallTiles(
        moves: CellMove[],
        moveCount: number,
        cells: number[],
        spawnedIndices: number[],
        spawnCount: number
    ): void {
        if (this.fallingCount > 0) {
            this.refreshLayout();
        }
        if (moveCount + spawnCount === 0) {
            return;
        }

        this.inputService.setEnabled(false);
        for (let i = 0; i < moveCount; i++) {
            const move = moves[i];
            const tile = this.tiles[move.from];
            this.tiles[move.from] = null;
            this.tiles[move.to] = tile;
            this.inputService.bind(tile.sprite.node, move.to);
            this.startFalling(tile, move.to);
        }

        this.columnSpawnCounts.fill(0);
        const rowStep = this.tileSize.height + this.tileSpacing.height;
        // SpawnService выдаёт индексы по возрастанию: новые клетки столбца идут снизу вверх.
        for (let i = 0; i < spawnCount; i++) {
            const index = spawnedIndices[i];
            const column = index % this.config.boardColumns;
            const spawnRow = this.config.boardRows + this.columnSpawnCounts[column];
            this.columnSpawnCounts[column]++;

            const tile = this.tilePool.get();
            tile.setSprite(this.colorSprites[cells[index]]);
            this.layoutTile(tile, index);
            tile.node.y = spawnRow * rowStep;
            this.tiles[index] = tile;
            this.inputService.bind(tile.sprite.node, index);
            this.startFalling(tile, index);
        }
    }

    private startFalling(tile: Tile, index: number): void {
        const slot = this.fallingCount++;
        const row = Math.floor(index / this.config.boardColumns);
        const targetY = row * (this.tileSize.height + this.tileSpacing.height);
        this.fallingTiles[slot] = tile;
        this.fallStartY[slot] = tile.node.y;
        this.fallTargetY[slot] = targetY;
        this.fallElapsed[slot] = 0;
        this.fallDurations[slot] = Math.abs(targetY - tile.node.y) / this.fallSpeed;
    }

    private updateFalling(deltaTime: number): void {
        if (this.fallingCount === 0) {
            return;
        }

        for (let i = 0; i < this.fallingTiles.length; i++) {
            const tile = this.fallingTiles[i];
            if (!tile) {
                continue;
            }

            const elapsed = this.fallElapsed[i] + deltaTime;
            const duration = this.fallDurations[i];
            const targetY = this.fallTargetY[i];
            this.fallElapsed[i] = elapsed;
            if (elapsed < duration) {
                tile.node.y = this.fallStartY[i] + (targetY - this.fallStartY[i]) * elapsed / duration;
                continue;
            }

            const bounceHeight = Math.min(this.landingBounceHeight, Math.abs(targetY - this.fallStartY[i]) * 0.08);
            const bounceProgress = (elapsed - duration) / this.landingBounceDuration;
            if (bounceHeight > 0 && bounceProgress < 1) {
                const remaining = 1 - bounceProgress;
                // Нулевая скорость на краях отскока обеспечивает мягкий возврат в ячейку.
                tile.node.y = targetY + 16 * bounceHeight * bounceProgress * bounceProgress * remaining * remaining;
                continue;
            }

            tile.node.y = targetY;
            this.fallingTiles[i] = null;
            this.fallingCount--;
        }

        if (this.fallingCount === 0) {
            this.inputService.setEnabled(true);
        }
    }

    private stopFalling(): void {
        this.fallingTiles.fill(null);
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
        )) * this.tileFillFactor;

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

        const column = index % this.config.boardColumns;
        const row = Math.floor(index / this.config.boardColumns);
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

    protected update(deltaTime: number): void {
        if (!this.config) {
            return;
        }

        if (this.tileSpacing.width !== this.lastTileSpacingX
            || this.tileSpacing.height !== this.lastTileSpacingY) {
            this.refreshLayout();
            return;
        }

        this.updateFalling(deltaTime);
    }

    protected onDestroy(): void {
        this.stopFalling();
        if (this.inputService) {
            this.inputService.dispose();
        }
    }
}
