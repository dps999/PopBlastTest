import type { GameConfig } from "../core/GameConfig";
import type BoardTileRenderer from "./BoardTileRenderer";

export interface BoardViewDependencies {
    tileRenderer: BoardTileRenderer;
    colorSprites: cc.SpriteFrame[];
    config: GameConfig;
}

const { ccclass, property } = cc._decorator;
const TILE_TOP_FACE_HEIGHT_RATIO = 0.14;

@ccclass
export default class BoardView extends cc.Component {
    @property({ type: cc.Sprite, tooltip: "Фон поля; размер его узла задаёт размеры ячеек." })
    private boardBackground: cc.Sprite = null;

    @property({ type: cc.Node, tooltip: "Центр нижнего левого тайла (ряд 0, столбец 0)." })
    private initialPoint: cc.Node = null;

    @property({ tooltip: "Отступ в масштабе исходного тайла; по Y отрицательное значение не перекрывает грани." })
    private tileSpacing: cc.Size = cc.size(4, 0);

    @property({ min: 1, max: 1.25, tooltip: "Насколько клетки заполняют внутреннюю область рамки." })
    private tileFillFactor: number = 1.12;

    private tileRenderer: BoardTileRenderer;
    private colorSprites: cc.SpriteFrame[];
    private config: GameConfig;
    private readonly tileSize: cc.Size = cc.size(0, 0);
    private readonly effectiveTileSpacing: cc.Size = cc.size(0, 0);
    private lastTileSpacingX: number = NaN;
    private lastTileSpacingY: number = NaN;

    public init(dependencies: BoardViewDependencies): void {
        this.tileRenderer = dependencies.tileRenderer;
        this.colorSprites = dependencies.colorSprites;
        this.config = dependencies.config;
        this.refreshLayout();
    }

    private updateTileSizeFromBackground(): void {
        const backgroundNode = this.boardBackground.node;
        const spriteFrame = this.boardBackground.spriteFrame;
        const fieldWidth = backgroundNode.width - spriteFrame.insetLeft - spriteFrame.insetRight;
        const fieldHeight = backgroundNode.height - spriteFrame.insetTop - spriteFrame.insetBottom;
        const originalTileSize = this.colorSprites[0].getOriginalSize();
        const verticalFaceSpacing = Math.max(0, this.tileSpacing.height);
        const availableWidth = fieldWidth * backgroundNode.scaleX / this.initialPoint.scaleX;
        const availableHeight = fieldHeight * backgroundNode.scaleY / this.initialPoint.scaleY;
        const tileColumnStepSize = originalTileSize.width + this.tileSpacing.width;
        const tileRowStepSize = originalTileSize.height
            + verticalFaceSpacing - originalTileSize.height * TILE_TOP_FACE_HEIGHT_RATIO;
        const gridWidth = originalTileSize.width
            + tileColumnStepSize * (this.config.boardColumns - 1);
        const gridHeight = originalTileSize.height
            + tileRowStepSize * (this.config.boardRows - 1);
        const tileScale = Math.max(0, Math.min(
            availableWidth / gridWidth,
            availableHeight / gridHeight
        )) * this.tileFillFactor;

        this.tileSize.width = originalTileSize.width * tileScale;
        this.tileSize.height = originalTileSize.height * tileScale;
        this.effectiveTileSpacing.width = this.tileSpacing.width * tileScale;
        this.effectiveTileSpacing.height = (verticalFaceSpacing
            - originalTileSize.height * TILE_TOP_FACE_HEIGHT_RATIO) * tileScale;
    }

    private refreshLayout(): void {
        this.updateTileSizeFromBackground();
        this.alignInitialPointToBackground();
        this.tileRenderer.setLayout(this.initialPoint, this.tileSize, this.effectiveTileSpacing);
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
            + this.effectiveTileSpacing.width * (this.config.boardColumns - 1)
        ) * this.initialPoint.scaleX;
        const gridHeight = (
            this.tileSize.height * this.config.boardRows
            + this.effectiveTileSpacing.height * (this.config.boardRows - 1)
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
