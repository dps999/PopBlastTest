export class BoardInputService {
    private readonly handlers: Map<cc.Node, () => void> = new Map();

    public bind(node: cc.Node, index: number): void {
        this.unbind(node);
        const handler = (): void => {
            cc.log("Нажатие на ячейку:", index);
        };
        node.on(cc.Node.EventType.TOUCH_END, handler);
        this.handlers.set(node, handler);
    }

    public unbind(node: cc.Node): void {
        const handler = this.handlers.get(node);
        if (handler) {
            node.off(cc.Node.EventType.TOUCH_END, handler);
            this.handlers.delete(node);
        }
    }

    public dispose(): void {
        this.handlers.forEach((handler, node) => {
            if (cc.isValid(node)) {
                node.off(cc.Node.EventType.TOUCH_END, handler);
            }
        });
        this.handlers.clear();
    }
}
