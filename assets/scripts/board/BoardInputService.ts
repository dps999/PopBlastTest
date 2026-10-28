import type { IBoardController } from "./IBoardController";

export class BoardInputService {
    private readonly controller: IBoardController;
    private readonly indices: Map<cc.Node, number> = new Map();
    private enabled: boolean = true;

    constructor(controller: IBoardController) {
        this.controller = controller;
    }

    public bind(node: cc.Node, index: number): void {
        if (!this.indices.has(node)) {
            node.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
        }
        this.indices.set(node, index);
    }

    public unbind(node: cc.Node): void {
        node.off(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.indices.delete(node);
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    public dispose(): void {
        this.indices.forEach(this.unbindOnDispose, this);
        this.indices.clear();
    }

    private onTouchEnd(event: cc.Event.EventTouch): void {
        if (!this.enabled) {
            return;
        }
        const index = this.indices.get(event.currentTarget);
        if (index === undefined) {
            return;
        }
        try {
            this.controller.onCellClicked(index);
        } catch (error) {
            cc.error(error);
        }
    }

    private unbindOnDispose(_index: number, node: cc.Node): void {
        if (cc.isValid(node)) {
            node.off(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
        }
    }
}
