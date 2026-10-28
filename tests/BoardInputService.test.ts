import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BoardInputService } from "../assets/scripts/board/BoardInputService.ts";

// Cocos подписывает обработчик с target и передаёт currentTarget в событии.
class TouchNode {
    private listeners: { handler: Function; target: unknown }[] = [];

    public on(_type: string, handler: Function, target?: unknown): void {
        this.listeners[this.listeners.length] = { handler, target };
    }

    public off(_type: string, handler: Function, target?: unknown): void {
        this.listeners = this.listeners.filter(function keepOtherListener(listener) {
            return listener.handler !== handler || listener.target !== target;
        });
    }

    public emit(_type: string): void {
        const event = { currentTarget: this };
        for (let i = 0; i < this.listeners.length; i++) {
            const listener = this.listeners[i];
            listener.handler.call(listener.target, event);
        }
    }

    public listenerCount(_type: string): number {
        return this.listeners.length;
    }
}

const originalCc = Object.getOwnPropertyDescriptor(globalThis, "cc");
const touchEnd = "touchend";

before(() => {
    Object.defineProperty(globalThis, "cc", {
        configurable: true,
        value: {
            Node: { EventType: { TOUCH_END: touchEnd } },
            isValid: () => true,
            error: (error: unknown) => { throw error; }
        }
    });
});

after(() => {
    if (originalCc) {
        Object.defineProperty(globalThis, "cc", originalCc);
    } else {
        Reflect.deleteProperty(globalThis, "cc");
    }
});

describe("BoardInputService", () => {
    it("ignores clicks while disabled and uses the new cell index after enabling", () => {
        const clicks: number[] = [];
        const service = new BoardInputService({ onCellClicked: (index) => { clicks.push(index); } });
        const node = new TouchNode();
        service.bind(node as unknown as cc.Node, 0);
        service.setEnabled(false);

        node.emit(touchEnd);
        service.bind(node as unknown as cc.Node, 5);
        node.emit(touchEnd);
        assert.deepEqual(clicks, []);

        service.setEnabled(true);
        node.emit(touchEnd);

        assert.deepEqual(clicks, [5]);
        assert.equal(node.listenerCount(touchEnd), 1);
        service.dispose();
    });

    it("does not dispatch clicks after a tile is unbound", () => {
        const clicks: number[] = [];
        const service = new BoardInputService({ onCellClicked: (index) => { clicks.push(index); } });
        const node = new TouchNode();
        service.bind(node as unknown as cc.Node, 0);
        node.emit(touchEnd);

        service.unbind(node as unknown as cc.Node);
        node.emit(touchEnd);

        assert.deepEqual(clicks, [0]);
        assert.equal(node.listenerCount(touchEnd), 0);
    });

    it("removes its subscriptions on disposal while preserving other listeners", () => {
        const clicks: number[] = [];
        const service = new BoardInputService({ onCellClicked: (index) => { clicks.push(index); } });
        const first = new TouchNode();
        const second = new TouchNode();
        let externalCalls = 0;
        first.on(touchEnd, () => { externalCalls++; });
        service.bind(first as unknown as cc.Node, 0);
        service.bind(second as unknown as cc.Node, 1);
        service.setEnabled(false);

        service.dispose();
        service.setEnabled(true);
        first.emit(touchEnd);
        second.emit(touchEnd);

        assert.deepEqual(clicks, []);
        assert.equal(externalCalls, 1);
        assert.equal(first.listenerCount(touchEnd), 1);
        assert.equal(second.listenerCount(touchEnd), 0);
    });
});
