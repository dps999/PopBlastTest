import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { it } from "node:test";

// Node не исполняет декораторы Cocos. Убираем только строки метаданных Inspector;
// методы компонентов исполняются без изменений, зависимости движка заменены заглушками.
globalThis.cc = {
    Component: class {},
    _decorator: {},
    size(width, height) { return { width, height }; }
};
const source = readFileSync(new URL("../assets/scripts/board/BoardView.ts", import.meta.url), "utf8")
    .replace(/^\s*@(?:ccclass|property\([^\n]*\))\s*$/gm, "");
const javascript = stripTypeScriptTypes(source);
const { default: BoardView } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
const rendererSource = readFileSync(new URL("../assets/scripts/board/BoardTileRenderer.ts", import.meta.url), "utf8")
    .replace(/^\s*@(?:ccclass|disallowMultiple|property\([^\n]*\))\s*$/gm, "");
const rendererJavascript = stripTypeScriptTypes(rendererSource);
const { default: BoardTileRenderer } = await import(`data:text/javascript;base64,${Buffer.from(rendererJavascript).toString("base64")}`);

function stepView(view, deltaTime) {
    view.update();
    view.tileRenderer.update(deltaTime);
}

class TileStub {
    node = {
        x: 0, y: 0, parent: null,
        setPosition(x, y) { this.x = x; this.y = y; }
    };
    sprite = { node: this.node };
    frame = null;
    size = null;
    setSprite(frame) { this.frame = frame; }
    setSize(size) { this.size = size; }
}

function createView(rows, columns, cells) {
    const view = new BoardView();
    const released = [];
    const pool = {
        createdCount: 0,
        get() {
            const tile = released.pop();
            if (tile) {
                return tile;
            }
            this.createdCount++;
            return new TileStub();
        },
        release(tile) { released[released.length] = tile; }
    };
    const input = {
        enabled: true,
        indices: new Map(),
        setEnabled(value) { this.enabled = value; },
        bind(node, index) { this.indices.set(node, index); },
        unbind(node) { this.indices.delete(node); },
        dispose() { this.indices.clear(); }
    };
    // Задаём точную геометрию теста, сохраняя реальные init/refreshLayout и анимацию.
    view.getTileSizeFromBackground = function testTileSize() { return { width: 10, height: 10 }; };
    view.alignInitialPointToBackground = function testAlignment() {};
    view.tileSpacing = { width: 0, height: 0 };
    view.initialPoint = {};
    const config = { boardRows: rows, boardColumns: columns };
    const colorSprites = ["red", "blue", "green"];
    const tileRenderer = new BoardTileRenderer();
    tileRenderer.fallSpeed = 10;
    tileRenderer.init({ tilePool: pool, colorSprites, config, inputService: input });
    view.init({ tileRenderer, colorSprites, config });
    view.initRender(cells);
    return { view, input, released, pool };
}

it("falls existing and pooled new tiles together and waits for the final landing bounce", function simultaneousFall() {
    const { view, input, released } = createView(3, 2, [0, 0, 1, 2, 2, 1]);
    const existing = view.tileRenderer.tiles[2];
    const removed = view.tileRenderer.tiles[0];
    const fallingBuffer = view.tileRenderer.fallingStates;
    const originalStates = new Set(fallingBuffer);
    view.removeTiles([0], 1);
    assert.equal(released.length, 1);
    view.fallTiles([{ from: 2, to: 0 }, { from: 4, to: 2 }], 2, [1, 0, 2, 2, 0, 1], [4, 999], 1);
    const fresh = view.tileRenderer.tiles[4];
    assert.strictEqual(fresh, removed);
    assert.equal(released.length, 0);
    assert.equal(fresh.frame, "red");
    assert.equal(fresh.node.x, 0);
    assert.equal(fresh.node.y, 30);
    assert.equal(input.indices.get(existing.node), 0);
    assert.equal(input.indices.get(fresh.node), 4);
    assert.equal(input.enabled, false);

    stepView(view, 0.5);
    assert.equal(existing.node.y, 7.5);
    assert.equal(fresh.node.y, 27.5);
    stepView(view, 0.58);
    assert.ok(existing.node.y > 0);
    assert.ok(fresh.node.y > 20);
    assert.equal(input.enabled, false);
    stepView(view, 0.1);
    assert.equal(existing.node.y, 0);
    assert.equal(fresh.node.y, 20);
    assert.equal(view.tileRenderer.fallingCount, 0);
    assert.equal(input.enabled, true);
    assert.strictEqual(view.tileRenderer.fallingStates, fallingBuffer);
    assert.equal(fallingBuffer.length, 6);
    assert.equal(originalStates.size, 6);
    assert.deepEqual(new Set(fallingBuffer), originalStates);
    stepView(view, 100);
    assert.equal(fresh.node.y, 20);
});

it("stacks new tiles above each column with different refill counts", function columnStacks() {
    const { view, input } = createView(3, 2, [0, 1, 2, 0, 1, 2]);
    view.removeTiles([0, 2, 4, 5], 4);
    view.fallTiles([], 0, [2, 1, 0, 0, 1, 2], [0, 2, 4, 5], 4);
    assert.deepEqual([view.tileRenderer.tiles[0].node.y, view.tileRenderer.tiles[2].node.y, view.tileRenderer.tiles[4].node.y, view.tileRenderer.tiles[5].node.y], [30, 40, 50, 30]);
    assert.equal(view.tileRenderer.tiles[5].node.x, 10);
    stepView(view, 1.2);
    assert.equal(view.tileRenderer.tiles[5].node.y, 20);
    assert.equal(input.enabled, false);
    assert.equal(view.tileRenderer.fallingCount, 3);
    stepView(view, 100);
    assert.deepEqual(view.tileRenderer.tiles.map(function y(tile) { return tile.node.y; }), [0, 0, 10, 10, 20, 20]);
    assert.equal(input.enabled, true);
});

it("refills a fully removed board without requiring existing moves", function allNewTiles() {
    const { view, input } = createView(2, 2, [0, 0, 0, 0]);
    const originalTiles = view.tileRenderer.tiles.slice();
    view.removeTiles([0, 1, 2, 3], 4);
    view.fallTiles([], 0, [1, 2, 0, 1], [0, 1, 2, 3], 4);
    assert.deepEqual(view.tileRenderer.tiles.map(function y(tile) { return tile.node.y; }), [20, 20, 30, 30]);
    assert.ok(view.tileRenderer.tiles.every(function pooled(tile) { return originalTiles.includes(tile); }));
    assert.equal(input.enabled, false);
    stepView(view, 100);
    assert.deepEqual(view.tileRenderer.tiles.map(function y(tile) { return tile.node.y; }), [0, 0, 10, 10]);
    assert.equal(input.enabled, true);
});

it("creates new tiles for empty cells when no released items are available", function createNewItems() {
    const { view, input, released, pool } = createView(2, 2, [0, -1, -1, -1]);
    const existing = view.tileRenderer.tiles[0];
    assert.equal(pool.createdCount, 1);
    assert.equal(released.length, 0);

    view.fallTiles([], 0, [0, 2, 1, 0], [1, 2, 3, 999], 3);

    assert.equal(pool.createdCount, 4);
    assert.strictEqual(view.tileRenderer.tiles[0], existing);
    assert.equal(new Set(view.tileRenderer.tiles).size, 4);
    assert.deepEqual(view.tileRenderer.tiles.map(function frame(tile) { return tile.frame; }), ["red", "green", "blue", "red"]);
    assert.deepEqual(view.tileRenderer.tiles.map(function x(tile) { return tile.node.x; }), [0, 10, 0, 10]);
    assert.deepEqual(view.tileRenderer.tiles.map(function y(tile) { return tile.node.y; }), [0, 20, 20, 30]);
    assert.strictEqual(view.tileRenderer.tiles[1].size, view.tileSize);
    assert.strictEqual(view.tileRenderer.tiles[2].size, view.tileSize);
    assert.strictEqual(view.tileRenderer.tiles[3].size, view.tileSize);
    assert.strictEqual(view.tileRenderer.tiles[1].node.parent, view.initialPoint);
    assert.strictEqual(view.tileRenderer.tiles[2].node.parent, view.initialPoint);
    assert.strictEqual(view.tileRenderer.tiles[3].node.parent, view.initialPoint);
    assert.equal(input.indices.get(view.tileRenderer.tiles[1].node), 1);
    assert.equal(input.indices.get(view.tileRenderer.tiles[2].node), 2);
    assert.equal(input.indices.get(view.tileRenderer.tiles[3].node), 3);
    assert.equal(input.enabled, false);

    stepView(view, 0.5);
    assert.deepEqual(view.tileRenderer.tiles.map(function y(tile) { return tile.node.y; }), [0, 18.75, 17.5, 28.75]);
    stepView(view, 100);
    assert.deepEqual(view.tileRenderer.tiles.map(function y(tile) { return tile.node.y; }), [0, 0, 10, 10]);
    assert.equal(input.enabled, true);
    assert.equal(pool.createdCount, 4);
});

it("snaps active falls to their cells on layout changes and clears them on destruction", function fallLifecycle() {
    const { view, input } = createView(2, 1, [0, 1]);
    view.removeTiles([1], 1);
    view.fallTiles([], 0, [0, 2], [1], 1);
    stepView(view, 0.5);
    view.tileSpacing.height = 2;
    stepView(view, 0.1);
    assert.equal(view.tileRenderer.tiles[1].node.y, 12);
    assert.equal(view.tileRenderer.fallingCount, 0);
    assert.equal(input.enabled, true);
    view.removeTiles([1], 1);
    view.fallTiles([], 0, [0, 1], [1], 1);
    view.tileRenderer.onDestroy();
    assert.equal(view.tileRenderer.fallingCount, 0);
    assert.ok(view.tileRenderer.fallingStates.every(function empty(state) { return state.tile === null; }));
    assert.equal(input.indices.size, 0);
});

it("leaves input enabled for an empty fall", function emptyFall() {
    const { view, input } = createView(1, 1, [0]);
    view.fallTiles([], 0, [0], [999], 0);
    assert.equal(input.enabled, true);
    assert.equal(view.tileRenderer.fallingCount, 0);
});

it("keeps a dense active prefix and reuses every state across turns", function reusableFallStates() {
    const { view, input } = createView(3, 2, [0, 0, 1, 2, 2, 1]);
    const buffer = view.tileRenderer.fallingStates;
    const originalStates = new Set(buffer);
    view.removeTiles([0, 1, 3], 3);
    view.fallTiles([{ from: 2, to: 0 }, { from: 4, to: 2 }, { from: 5, to: 1 }], 3,
        [1, 1, 2, 0, 1, 2], [3, 4, 5], 3);
    assert.equal(view.tileRenderer.fallingCount, 6);

    stepView(view, 1.2);
    assert.equal(view.tileRenderer.fallingCount, 3);
    assert.equal(input.enabled, false);
    assert.ok(Math.abs(view.tileRenderer.tiles[1].node.y - 12.8) < 1e-10);
    assert.ok(Math.abs(view.tileRenderer.tiles[3].node.y - 22.8) < 1e-10);
    assert.ok(Math.abs(view.tileRenderer.tiles[5].node.y - 32.8) < 1e-10);
    for (let i = 0; i < buffer.length; i++) {
        assert.equal(buffer[i].tile !== null, i < view.tileRenderer.fallingCount);
        if (i < view.tileRenderer.fallingCount) {
            assert.equal(buffer[i].elapsed, 1.2);
        }
    }

    stepView(view, 0.3);
    assert.equal(view.tileRenderer.tiles[1].node.y, 8.75);
    assert.equal(view.tileRenderer.tiles[3].node.y, 18.75);
    assert.equal(view.tileRenderer.tiles[5].node.y, 28.75);
    stepView(view, 100);
    assert.equal(view.tileRenderer.fallingCount, 0);
    assert.equal(input.enabled, true);
    assert.ok(buffer.every(function idle(state) { return state.tile === null; }));

    view.removeTiles([4, 5], 2);
    view.fallTiles([], 0, [1, 1, 2, 0, 2, 1], [4, 5], 2);
    assert.equal(view.tileRenderer.fallingCount, 2);
    assert.equal(buffer[0].elapsed, 0);
    assert.equal(buffer[1].elapsed, 0);
    stepView(view, 0.5);
    assert.equal(view.tileRenderer.tiles[4].node.y, 27.5);
    assert.equal(view.tileRenderer.tiles[5].node.y, 27.5);
    view.tileRenderer.stopFalling();
    assert.equal(view.tileRenderer.fallingCount, 0);
    assert.ok(buffer.every(function idle(state) { return state.tile === null; }));
    assert.strictEqual(view.tileRenderer.fallingStates, buffer);
    assert.equal(buffer.length, 6);
    assert.equal(originalStates.size, 6);
    assert.deepEqual(new Set(buffer), originalStates);
});

it("updates animations in BoardTileRenderer independently of BoardView", function separateAnimationUpdate() {
    const { view, input } = createView(2, 1, [0, 1]);
    const renderer = view.tileRenderer;
    view.removeTiles([1], 1);
    view.fallTiles([], 0, [0, 2], [1], 1);
    const fresh = renderer.tiles[1];
    assert.equal(fresh.node.y, 20);
    assert.equal(input.enabled, false);
    view.update();
    assert.equal(fresh.node.y, 20);
    renderer.update(0.5);
    assert.equal(fresh.node.y, 17.5);
    renderer.update(100);
    assert.equal(fresh.node.y, 10);
    assert.equal(input.enabled, true);
});


it("changes the sprite in place and reuses the same common pool", function strategyRendering() {
    const { view, released, pool } = createView(2, 2, [0, 1, 2, 0]);
    const tile = view.tileRenderer.tiles[2];
    const created = pool.createdCount;
    const strategy = { spriteFrame: "row" };
    view.tileRenderer.superTiles = { getStrategy(value) { return value === 3 ? strategy : null; } };
    view.transformTile(2, 3);
    assert.strictEqual(view.tileRenderer.tiles[2], tile);
    assert.equal(tile.frame, "row");
    assert.equal(pool.createdCount, created);
    assert.equal(released.length, 0);
    view.removeTiles([0], 1);
    view.fallTiles([{ from: 2, to: 0 }], 1, [0, 1, 2, 0], [2], 1);
    stepView(view, 100);
    assert.strictEqual(view.tileRenderer.tiles[0], tile);
    assert.equal(tile.frame, "row");
    view.removeTiles([0], 1);
    view.fallTiles([], 0, [1, 1, 2, 0], [0], 1);
    assert.strictEqual(view.tileRenderer.tiles[0], tile);
    assert.equal(tile.frame, "blue");
    assert.equal(pool.createdCount, created);
});
