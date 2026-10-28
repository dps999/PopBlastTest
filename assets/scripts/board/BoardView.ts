import type { GameConfig } from "../core/GameConfig";
import type { IBoardView } from "./IBoardView";
import type { CellMove } from "./IBoardEngine";
import type BoardTileRenderer from "./BoardTileRenderer";
import type { IInitializable } from "../core/IInitializable";

export interface BoardViewDependencies {
    tileRenderer: BoardTileRenderer;
    colorSprites: cc.SpriteFrame[];
    config: GameConfig;
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

    private tileRenderer: BoardTileRenderer;
    private colorSprites: cc.SpriteFrame[];
    private config: GameConfig;
    private tileSize: cc.Size = cc.size(0, 0);
    private lastTileSpacingX: number = NaN;
    private lastTileSpacingY: number = NaN;

    public init(dependencies: BoardViewDependencies): void {
        this.tileRenderer = dependencies.tileRenderer;
        this.colorSprites = dependencies.colorSprites;
        this.config = dependencies.config;
        this.refreshLayout();
    }

    public initRender(cells: number[]): void {
        this.tileRenderer.initRender(cells);
    }

    public transformTile(index: number, value: number): void {
        this.tileRenderer.transformTile(index, value);
    }

    public removeTiles(indices: number[], count: number): void {
        this.tileRenderer.removeTiles(indices, count);
    }

    public mergeTiles(indices: number[], count: number, targetIndex: number): void {
        this.tileRenderer.mergeTiles(indices, count, targetIndex);
    }

    public swapTiles(first: number, second: number): void {
        this.tileRenderer.swapTiles(first, second);
    }

    public setSelectedCell(index: number): void {
        this.tileRenderer.setSelectedCell(index);
    }

    public fallTiles(
        moves: CellMove[],
        moveCount: number,
        cells: number[],
        spawnedIndices: number[],
        spawnCount: number
    ): void {
        this.tileRenderer.fallTiles(moves, moveCount, cells, spawnedIndices, spawnCount);
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
        this.tileSize = this.getTileSizeFromBackground();
        this.alignInitialPointToBackground();
        this.tileRenderer.setLayout(this.initialPoint, this.tileSize, this.tileSpacing);
        this.lastTileSpacingX = this.tileSpacing.width;
        this.lastTileSpacingY = this.tileSpacing.height;
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

    protected update(): void {
        if (!this.config) {
            return;
        }

        if (this.tileSpacing.width !== this.lastTileSpacingX
            || this.tileSpacing.height !== this.lastTileSpacingY) {
            this.refreshLayout();
        }
    }
}
