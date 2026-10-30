/** Адаптирует те же группы HUD к портретной и горизонтальной ориентации. */
export default class HudLayout {
    private static readonly PANEL_GAP: number = 24;
    private static readonly VIEW_MARGIN: number = 24;
    private static readonly MAX_SCALE: number = 1.6;

    private readonly hudNode: cc.Node;
    private readonly topNode: cc.Node;
    private readonly bottomNode: cc.Node;
    private readonly boardNode: cc.Node;

    private readonly topX: number;
    private readonly topY: number;
    private readonly topScaleX: number;
    private readonly topScaleY: number;
    private readonly bottomX: number;
    private readonly bottomY: number;
    private readonly bottomScaleX: number;
    private readonly bottomScaleY: number;
    private readonly boardX: number;
    private readonly boardY: number;
    private readonly boardScaleX: number;
    private readonly boardScaleY: number;

    private boundsMinX: number = 0;
    private boundsMinY: number = 0;
    private boundsMaxX: number = 0;
    private boundsMaxY: number = 0;
    private hasBounds: boolean = false;

    private topBoundsMinX: number = 0;
    private topBoundsMinY: number = 0;
    private topBoundsMaxX: number = 0;
    private topBoundsMaxY: number = 0;
    private bottomBoundsMinX: number = 0;
    private bottomBoundsMinY: number = 0;
    private bottomBoundsMaxX: number = 0;
    private bottomBoundsMaxY: number = 0;

    constructor(hudNode: cc.Node) {
        const canvasNode = hudNode.parent;
        if (!canvasNode) {
            throw new Error("HudLayout requires Hud to be a child of Canvas.");
        }

        this.hudNode = hudNode;
        this.topNode = hudNode.getChildByName("Top");
        this.bottomNode = hudNode.getChildByName("Bottom");
        this.boardNode = canvasNode.getChildByName("GameBoard");
        if (!this.topNode || !this.bottomNode || !this.boardNode) {
            throw new Error("HudLayout requires Top, Bottom, and GameBoard nodes.");
        }

        this.topX = this.topNode.x;
        this.topY = this.topNode.y;
        this.topScaleX = this.topNode.scaleX;
        this.topScaleY = this.topNode.scaleY;
        this.bottomX = this.bottomNode.x;
        this.bottomY = this.bottomNode.y;
        this.bottomScaleX = this.bottomNode.scaleX;
        this.bottomScaleY = this.bottomNode.scaleY;
        this.boardX = this.boardNode.x;
        this.boardY = this.boardNode.y;
        this.boardScaleX = this.boardNode.scaleX;
        this.boardScaleY = this.boardNode.scaleY;

        this.measureBounds(this.topNode);
        this.topBoundsMinX = this.boundsMinX;
        this.topBoundsMinY = this.boundsMinY;
        this.topBoundsMaxX = this.boundsMaxX;
        this.topBoundsMaxY = this.boundsMaxY;

        this.measureBounds(this.bottomNode);
        this.bottomBoundsMinX = this.boundsMinX;
        this.bottomBoundsMinY = this.boundsMinY;
        this.bottomBoundsMaxX = this.boundsMaxX;
        this.bottomBoundsMaxY = this.boundsMaxY;
    }

    public enable(): void {
        cc.view.on("canvas-resize", this.apply, this);
        this.apply();
    }

    public refresh(): void {
        this.measureBounds(this.topNode);
        this.topBoundsMinX = this.boundsMinX;
        this.topBoundsMinY = this.boundsMinY;
        this.topBoundsMaxX = this.boundsMaxX;
        this.topBoundsMaxY = this.boundsMaxY;

        this.measureBounds(this.bottomNode);
        this.bottomBoundsMinX = this.boundsMinX;
        this.bottomBoundsMinY = this.boundsMinY;
        this.bottomBoundsMaxX = this.boundsMaxX;
        this.bottomBoundsMaxY = this.boundsMaxY;
        this.apply();
    }

    public dispose(): void {
        cc.view.off("canvas-resize", this.apply, this);
    }

    private apply(): void {
        const frameSize = cc.view.getFrameSize();
        const visibleSize = cc.view.getVisibleSize();
        if (frameSize.width <= frameSize.height) {
            this.restorePortraitLayout();
            return;
        }

        this.applyLandscapeLayout(visibleSize.width, visibleSize.height);
    }

    private restorePortraitLayout(): void {
        this.boardNode.setPosition(this.boardX, this.boardY);
        this.boardNode.setScale(this.boardScaleX, this.boardScaleY);
        this.topNode.setPosition(this.topX, this.topY);
        this.topNode.setScale(this.topScaleX, this.topScaleY);
        this.bottomNode.setPosition(this.bottomX, this.bottomY);
        this.bottomNode.setScale(this.bottomScaleX, this.bottomScaleY);
    }

    private applyLandscapeLayout(visibleWidth: number, visibleHeight: number): void {
        const boardLeft = this.boardX - this.boardNode.width * this.boardNode.anchorX * this.boardScaleX;
        const boardRight = this.boardX
            + this.boardNode.width * (1 - this.boardNode.anchorX) * this.boardScaleX;
        const boardCenterY = this.boardY
            + this.boardNode.height * (0.5 - this.boardNode.anchorY) * this.boardScaleY;
        const boardHeight = this.boardNode.height * Math.abs(this.boardScaleY);
        const panelGap = HudLayout.PANEL_GAP;

        const topWidth = (this.topBoundsMaxX - this.topBoundsMinX) * Math.abs(this.topScaleX);
        const topHeight = (this.topBoundsMaxY - this.topBoundsMinY) * Math.abs(this.topScaleY);
        const bottomWidth = (this.bottomBoundsMaxX - this.bottomBoundsMinX) * Math.abs(this.bottomScaleX);
        const bottomHeight = (this.bottomBoundsMaxY - this.bottomBoundsMinY) * Math.abs(this.bottomScaleY);
        const panelColumnWidth = Math.max(topWidth, bottomWidth);
        const layoutWidth = boardRight - boardLeft + panelGap + panelColumnWidth;
        const layoutHeight = Math.max(boardHeight, topHeight + panelGap + bottomHeight);
        const availableWidth = Math.max(0, visibleWidth - HudLayout.VIEW_MARGIN * 2);
        const availableHeight = Math.max(0, visibleHeight - HudLayout.VIEW_MARGIN * 2);
        const widthScale = layoutWidth > 0 ? availableWidth / layoutWidth : 1;
        const heightScale = layoutHeight > 0 ? availableHeight / layoutHeight : 1;
        const contentScale = Math.min(HudLayout.MAX_SCALE, widthScale, heightScale);
        const layoutRight = boardRight + panelGap + panelColumnWidth;
        const layoutCenterX = (boardLeft + layoutRight) * 0.5;

        this.boardNode.setScale(
            this.boardScaleX * contentScale,
            this.boardScaleY * contentScale
        );
        this.boardNode.setPosition(
            (this.boardX - layoutCenterX) * contentScale,
            (this.boardY - boardCenterY) * contentScale
        );

        const scaledBoardRight = (boardRight - layoutCenterX) * contentScale;
        const panelCenterX = scaledBoardRight
            + (panelGap + panelColumnWidth * 0.5) * contentScale;
        const topScaleX = this.topScaleX * contentScale;
        const topScaleY = this.topScaleY * contentScale;
        const bottomScaleX = this.bottomScaleX * contentScale;
        const bottomScaleY = this.bottomScaleY * contentScale;
        const topCenterY = (bottomHeight * 0.5 + panelGap * 0.5) * contentScale;
        const topOffsetX = (this.topBoundsMinX + this.topBoundsMaxX) * 0.5 * topScaleX;
        const topOffsetY = (this.topBoundsMinY + this.topBoundsMaxY) * 0.5 * topScaleY;
        this.topNode.setScale(topScaleX, topScaleY);
        this.topNode.setPosition(
            panelCenterX - this.hudNode.x - topOffsetX,
            topCenterY - this.hudNode.y - topOffsetY
        );

        const bottomCenterY = -(topHeight * 0.5 + panelGap * 0.5) * contentScale;
        const bottomOffsetX = (this.bottomBoundsMinX + this.bottomBoundsMaxX) * 0.5 * bottomScaleX;
        const bottomOffsetY = (this.bottomBoundsMinY + this.bottomBoundsMaxY) * 0.5 * bottomScaleY;
        this.bottomNode.setScale(bottomScaleX, bottomScaleY);
        this.bottomNode.setPosition(
            panelCenterX - this.hudNode.x - bottomOffsetX,
            bottomCenterY - this.hudNode.y - bottomOffsetY
        );
    }

    private measureBounds(group: cc.Node): void {
        this.boundsMinX = 0;
        this.boundsMinY = 0;
        this.boundsMaxX = 0;
        this.boundsMaxY = 0;
        this.hasBounds = false;

        // Группа служит контейнером; учитываем только размеры её дочерних элементов.
        for (let i = 0; i < group.childrenCount; i++) {
            this.measureNode(group.children[i], 0, 0, 1, 1);
        }
    }

    private measureNode(
        node: cc.Node,
        parentX: number,
        parentY: number,
        parentScaleX: number,
        parentScaleY: number
    ): void {
        const x = parentX + node.x * parentScaleX;
        const y = parentY + node.y * parentScaleY;
        const scaleX = parentScaleX * node.scaleX;
        const scaleY = parentScaleY * node.scaleY;
        const width = node.width * scaleX;
        const height = node.height * scaleY;
        const left = x - node.anchorX * width;
        const right = x + (1 - node.anchorX) * width;
        const bottom = y - node.anchorY * height;
        const top = y + (1 - node.anchorY) * height;
        if (node.width > 0 || node.height > 0) {
            this.includeBounds(
                Math.min(left, right),
                Math.min(bottom, top),
                Math.max(left, right),
                Math.max(bottom, top)
            );
        }

        for (let i = 0; i < node.childrenCount; i++) {
            this.measureNode(node.children[i], x, y, scaleX, scaleY);
        }
    }

    private includeBounds(left: number, bottom: number, right: number, top: number): void {
        if (!this.hasBounds) {
            this.boundsMinX = left;
            this.boundsMinY = bottom;
            this.boundsMaxX = right;
            this.boundsMaxY = top;
            this.hasBounds = true;
            return;
        }

        this.boundsMinX = Math.min(this.boundsMinX, left);
        this.boundsMinY = Math.min(this.boundsMinY, bottom);
        this.boundsMaxX = Math.max(this.boundsMaxX, right);
        this.boundsMaxY = Math.max(this.boundsMaxY, top);
    }
}
