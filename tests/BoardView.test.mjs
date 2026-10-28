import assert from "node:assert/strict";
import { it } from "node:test";
import { loadGameModule } from "./helpers/CocosComponents.mjs";

const { default: BoardView } = await import(await loadGameModule("board/BoardView.ts"));
const { default: BoardTileRenderer } = await import(await loadGameModule("board/BoardTileRenderer.ts"));
const { BoardController } = await import(await loadGameModule("board/BoardController.ts"));

function stepView(view, deltaTime) {
    const renderer = view.tileRenderer;
    for (let i = 0; i < renderer.activeParticleCount; i++) {
        const particles = renderer.activeParticleSystems[i];
        particles.elapsed += deltaTime;
        if (particles.elapsed >= 0.42) { particles.stopped = true; particles.particleCount = 0; }
    }
    view.update();
    view.tileRenderer.update(deltaTime);
}

class TileStub {
    node = {
        x: 0, y: 0, parent: null, scale: 1, opacity: 255,
        color: { r: 255, g: 255, b: 255, a: 255 },
        setSiblingIndex(index) { this.siblingIndex = index; },
        setPosition(x, y) { this.x = x; this.y = y; }
    };
    sprite = { node: this.node, spriteFrame: null };
    frame = null;
    size = null;
    setSprite(frame) { this.frame = frame; this.sprite.spriteFrame = frame; }
    setSize(size) { this.size = size; }
}

class ParticleStub {
    stopped = false;
    particleCount = 0;
    resets = 0;
    elapsed = 0;
    node = { active: false, parent: null, x: 0, y: 0,
        setPosition(x, y) { this.x = x; this.y = y; } };
    constructor() { this.node.particles = this; this.node.getComponent = particlesOf; }
    resetSystem() { this.stopped = false; this.elapsed = 0; this.resets++; }
}

function particlesOf() { return this.particles; }

const particlePrefab = { instantiate() { return new ParticleStub().node; } };

function createView(rows, columns, cells, initialize = true) {
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
        deactivate(node) { if (this.indices.has(node)) { this.indices.set(node, -1); } },
        dispose() { this.indices.clear(); }
    };
    // Задаём точную геометрию теста, сохраняя реальные init/refreshLayout и анимацию.
    view.getTileSizeFromBackground = function testTileSize() { return { width: 10, height: 10 }; };
    view.alignInitialPointToBackground = function testAlignment() {};
    view.tileSpacing = { width: 0, height: 0 };
    view.initialPoint = { childrenCount: rows * columns };
    const config = { boardRows: rows, boardColumns: columns };
    const colorSprites = ["red", "blue", "green"];
    const tileRenderer = new BoardTileRenderer();
    tileRenderer.fallSpeed = 10;
    tileRenderer.init({ tilePool: pool, colorSprites, config, inputService: input, tileRemovalParticlePrefab: particlePrefab });
    view.init({ tileRenderer, colorSprites, config });
    if (initialize) { view.initRender(cells); }
    return { view, input, released, pool };
}

it("teleport swaps existing tile nodes, restores tint and rebinds both input indices", function teleportRendering() {
    const { view, input, released, pool } = createView(3, 2, [0, 1, 2, 0, 1, 2]);
    const first = view.tileRenderer.tiles[0];
    const second = view.tileRenderer.tiles[5];
    view.setSelectedCell(0);
    assert.deepEqual(first.node.color, { r: 255, g: 225, b: 100, a: 255 });
    view.swapTiles(0, 5);
    assert.strictEqual(view.tileRenderer.tiles[5], first);
    assert.strictEqual(view.tileRenderer.tiles[0], second);
    assert.equal(first.frame, "red"); assert.equal(second.frame, "green");
    assert.deepEqual(first.node.color, { r: 255, g: 255, b: 255, a: 255 });
    assert.equal(first.node.x, 10); assert.equal(first.node.y, 20);
    assert.equal(second.node.x, 0); assert.equal(second.node.y, 0);
    assert.equal(input.indices.get(first.node), 5); assert.equal(input.indices.get(second.node), 0);
    assert.equal(input.enabled, true); assert.equal(pool.createdCount, 6); assert.equal(released.length, 0);
    assert.equal(view.tileRenderer.fallingCount, 0);
    view.setSelectedCell(5); view.setSelectedCell(-1);
    assert.deepEqual(first.node.color, { r: 255, g: 255, b: 255, a: 255 });
});

it("selection tint never leaks into pooled tiles after removal or destruction", function selectionCleanup() {
    const { view, released } = createView(1, 2, [0, 1]);
    view.setSelectedCell(0); view.setSelectedCell(1);
    assert.deepEqual(view.tileRenderer.tiles[0].node.color, { r: 255, g: 255, b: 255, a: 255 });
    view.removeTiles([1], 1);
    stepView(view, 0.36);
    assert.deepEqual(released[0].node.color, { r: 255, g: 255, b: 255, a: 255 });
    const tile = view.tileRenderer.tiles[0];
    view.setSelectedCell(0); view.tileRenderer.onDestroy();
    assert.deepEqual(tile.node.color, { r: 255, g: 255, b: 255, a: 255 });
});

it("falls existing and pooled new tiles together and waits for the final landing bounce", function simultaneousFall() {
    const { view, input, released } = createView(3, 2, [0, 0, 1, 2, 2, 1]);
    const existing = view.tileRenderer.tiles[2];
    const removed = view.tileRenderer.tiles[0];
    const fallingBuffer = view.tileRenderer.fallingStates;
    const originalStates = new Set(fallingBuffer);
    view.removeTiles([0], 1);
    assert.equal(input.indices.get(removed.node), -1);
    stepView(view, 0.36);
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
    stepView(view, 0.36);
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
    assert.equal(input.enabled, false);
    stepView(view, 0.5);
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
    assert.equal(input.enabled, false);
    renderer.activeParticleSystems[0].stopped = true;
    renderer.update(0);
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
    stepView(view, 0.36);
    view.fallTiles([{ from: 2, to: 0 }], 1, [0, 1, 2, 0], [2], 1);
    stepView(view, 100);
    assert.strictEqual(view.tileRenderer.tiles[0], tile);
    assert.equal(tile.frame, "row");
    view.removeTiles([0], 1);
    stepView(view, 0.36);
    view.fallTiles([], 0, [1, 1, 2, 0], [0], 1);
    assert.strictEqual(view.tileRenderer.tiles[0], tile);
    assert.equal(tile.frame, "blue");
    assert.equal(pool.createdCount, created);
});

it("delays particles, keeps shrinking tiles out of the pool and locks input until both animations finish", function removalAndFall() {
    const { view, input, released, pool } = createView(1, 1, [0]);
    const renderer = view.tileRenderer;
    const removed = renderer.tiles[0];
    const particleNodes = renderer.particlePool.items.slice();
    const states = renderer.removalStates;
    renderer.fallSpeed = 1000;
    view.removeTiles([0], 1);
    assert.equal(renderer.tiles[0], null);
    assert.equal(input.indices.get(removed.node), -1);
    assert.equal(input.enabled, false);
    assert.equal(released.length, 0);
    assert.equal(renderer.activeParticleCount, 0);
    view.fallTiles([], 0, [1], [0], 1);
    assert.notStrictEqual(renderer.tiles[0], removed);
    assert.equal(pool.createdCount, 2);
    stepView(view, 0.04);
    assert.equal(renderer.activeParticleCount, 0);
    assert.ok(removed.node.scale < 1 && removed.node.scale > 0);
    assert.ok(removed.node.opacity < 255 && removed.node.opacity > 0);
    stepView(view, 0.05);
    assert.equal(renderer.activeParticleCount, 1);
    const particles = renderer.activeParticleSystems[0];
    assert.ok(particleNodes.includes(particles.node));
    assert.equal(particles.spriteFrame, "red");
    assert.equal(particles.node.parent, view.initialPoint);
    assert.equal(particles.node.x, removed.node.x); assert.equal(particles.node.y, removed.node.y);
    assert.equal(particles.resets, 1);
    stepView(view, 0.1);
    assert.equal(renderer.fallingCount, 0);
    assert.equal(renderer.removalCount, 1);
    assert.equal(input.enabled, false);
    assert.equal(released.length, 0);
    stepView(view, 0.2);
    assert.equal(renderer.removalCount, 0);
    assert.strictEqual(released[0], removed);
    assert.equal(removed.node.scale, 1); assert.equal(removed.node.opacity, 255);
    assert.equal(input.enabled, false);
    assert.equal(particles.resets, 1);
    assert.strictEqual(renderer.removalStates, states);
    assert.equal(states[0].tile, null);
    particles.stopped = true;
    particles.particleCount = 1;
    stepView(view, 0);
    assert.equal(renderer.activeParticleCount, 1);
    particles.particleCount = 0;
    stepView(view, 0);
    assert.equal(renderer.activeParticleCount, 0);
    assert.equal(input.enabled, true);
    assert.equal(particles.node.active, false);
    assert.deepEqual(renderer.particlePool.items, particleNodes);
});

function createPipeline(merge) {
    const cells = [0, 0, 0];
    const fixture = createView(3, 1, cells, false);
    const model = { cells, init() {}, getCells() { return this.cells; } };
    const spawn = {
        calls: 0,
        spawn(values, indices) {
            this.calls++;
            if (!indices) { return 0; }
            indices[0] = 2;
            values[2] = 1;
            return 1;
        }
    };
    const controller = new BoardController(model, fixture.view, null, spawn);
    controller.init();
    const result = {
        valid: true, removedIndices: [0], removedCount: 1,
        transformedIndex: merge ? 1 : -1, transformedValue: 2,
        swappedFirstIndex: -1,
        moves: [{ from: 1, to: 0 }, { from: 2, to: 1 }], moveCount: 2
    };
    return { ...fixture, controller, result, spawn };
}

it("awaits the complete merge before starting fall and resolves only after the landing bounce", async function mergePipeline() {
    const { view, input, controller, result, spawn } = createPipeline(true);
    const renderer = view.tileRenderer;
    const source = renderer.tiles[0];
    const target = renderer.tiles[1];
    const turn = controller.applyTurnResult(result);
    const mergeWait = view.waitForAnimations();
    assert.strictEqual(view.waitForAnimations(), mergeWait);
    stepView(view, 0.18);
    await Promise.resolve();
    assert.equal(source.node.scale, 1);
    assert.equal(source.node.y, 5);
    assert.equal(target.node.y, 10);
    assert.equal(renderer.fallingCount, 0);
    assert.equal(spawn.calls, 1);
    assert.equal(input.enabled, false);
    stepView(view, 0.18);
    assert.equal(renderer.fallingCount, 0);
    await Promise.resolve();
    assert.equal(renderer.fallingCount, 3);
    assert.equal(spawn.calls, 2);
    assert.strictEqual(renderer.tiles[0], target);
    assert.equal(input.enabled, false);
    stepView(view, 1.08);
    await Promise.resolve();
    assert.ok(target.node.y > 0);
    assert.equal(input.enabled, false);
    stepView(view, 0.1);
    assert.equal(await turn, true);
    assert.equal(target.node.y, 0);
    assert.equal(input.enabled, true);
});

it("awaits removal particles as well as the removed tiles before starting fall", async function removalPipeline() {
    const { view, input, controller, result, spawn } = createPipeline(false);
    const renderer = view.tileRenderer;
    const upper = renderer.tiles[1];
    const turn = controller.applyTurnResult(result);
    stepView(view, 0.09);
    stepView(view, 0.27);
    await Promise.resolve();
    assert.equal(renderer.removalCount, 0);
    assert.equal(renderer.activeParticleCount, 1);
    assert.equal(renderer.fallingCount, 0);
    assert.equal(upper.node.y, 10);
    assert.equal(spawn.calls, 1);
    assert.equal(input.enabled, false);
    stepView(view, 0.2);
    assert.equal(renderer.fallingCount, 0);
    await Promise.resolve();
    assert.equal(renderer.activeParticleCount, 0);
    assert.equal(renderer.fallingCount, 3);
    stepView(view, 2);
    assert.equal(await turn, true);
    assert.equal(input.enabled, true);
});

it("cancels an awaited merge when destroyed and never starts falling", async function cancelledMerge() {
    const { view, controller, result, spawn } = createPipeline(true);
    const turn = controller.applyTurnResult(result);
    stepView(view, 0.18);
    view.tileRenderer.onDestroy();
    assert.equal(await turn, false);
    assert.equal(spawn.calls, 1);
    assert.equal(view.tileRenderer.fallingCount, 0);
});

it("cancels an awaited fall when the renderer is destroyed", async function cancelledFall() {
    const { view, controller, result } = createPipeline(true);
    const turn = controller.applyTurnResult(result);
    stepView(view, 0.36);
    await Promise.resolve();
    assert.equal(view.tileRenderer.fallingCount, 3);
    view.tileRenderer.onDestroy();
    assert.equal(await turn, false);
});
