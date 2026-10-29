import assert from "node:assert/strict";
import { it } from "node:test";
import { readFileSync } from "node:fs";
import { loadGameModule } from "./helpers/CocosComponents.mjs";

const { default: TiledParticleTexture } = await import(await loadGameModule("tiles/TiledParticleTexture.ts"));

let randomIndex = 0;
function nextCellRandom() { return (randomIndex++ % 4 + 0.5) / 4; }
function emitParticle() { this.particles[this.particles.length] = this.available[this.nextParticle++ % 4]; }
function updateUVs() { this.uvUpdates++; }
function updateParticleBuffer(particle, position, buffer, offset) { buffer._vData[offset] = position.x; }
function getParticleSystem() { this.componentQueries++; return this.particleSystem; }

function compressedUuid(uuid) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const hex = uuid.replace(/-/g, "");
    let result = hex.slice(0, 5);
    for (let i = 5; i < hex.length; i += 3) {
        const value = parseInt(hex.slice(i, i + 3), 16);
        result += alphabet[value >> 6] + alphabet[value & 63];
    }
    return result;
}

function createFixture() {
    const simulator = {
        sys: { _renderSpriteFrame: {
            values: [0, 1, 1, 1, 0, 0, 1, 0],
            reads: 0,
            get uv() { this.reads++; return this.values; },
            set uv(value) { this.values = value; }
        } },
        particles: [],
        available: [{}, {}, {}, {}],
        nextParticle: 0,
        uvUpdates: 0,
        emitParticle,
        updateUVs,
        updateParticleBuffer
    };
    const component = new TiledParticleTexture();
    component.particleSystem = { _simulator: simulator };
    component.componentQueries = 0;
    component.getComponent = getParticleSystem;
    component.onEnable();
    return { component, simulator, buffer: { _vData: new Float32Array(80) }, position: { x: 7, y: 9 } };
}

function readUVs(buffer, offset = 0) {
    const data = buffer._vData;
    return [data[offset + 2], data[offset + 3], data[offset + 7], data[offset + 8],
        data[offset + 12], data[offset + 13], data[offset + 17], data[offset + 18]];
}

it("selects all four 2x2 cells independently and preserves particle geometry", function cells(t) {
    randomIndex = 0;
    t.mock.method(Math, "random", nextCellRandom);
    const { simulator, buffer, position } = createFixture();
    const expected = [
        [0, 1, 0.5, 1, 0, 0.5, 0.5, 0.5],
        [0.5, 1, 1, 1, 0.5, 0.5, 1, 0.5],
        [0, 0.5, 0.5, 0.5, 0, 0, 0.5, 0],
        [0.5, 0.5, 1, 0.5, 0.5, 0, 1, 0]
    ];
    for (let i = 0; i < 4; i++) {
        simulator.emitParticle(position);
        simulator.updateParticleBuffer(simulator.particles[i], position, buffer, i * 20);
        assert.equal(buffer._vData[i * 20], position.x);
        assert.deepEqual(readUVs(buffer, i * 20), expected[i]);
    }
    assert.equal(Math.random.mock.calls.length, 4);
});

it("keeps the chosen cell after compaction and chooses again when a pooled particle is emitted", function reuse(t) {
    randomIndex = 0;
    t.mock.method(Math, "random", nextCellRandom);
    const { component, simulator, buffer, position } = createFixture();
    simulator.emitParticle(position);
    simulator.emitParticle(position);
    const reused = simulator.particles[0];
    simulator.particles[0] = simulator.particles[1];
    simulator.particles.length = 1;
    simulator.updateParticleBuffer(simulator.particles[0], position, buffer, 0);
    const before = readUVs(buffer);
    simulator.updateParticleBuffer(simulator.particles[0], position, buffer, 0);
    assert.deepEqual(readUVs(buffer), before);
    assert.equal(Math.random.mock.calls.length, 2);

    component.onDisable();
    assert.strictEqual(simulator.emitParticle, emitParticle);
    assert.strictEqual(simulator.updateUVs, updateUVs);
    assert.strictEqual(simulator.updateParticleBuffer, updateParticleBuffer);
    simulator.particles.length = 0;
    simulator.nextParticle = 0;
    component.onEnable();
    simulator.emitParticle(position);
    assert.strictEqual(simulator.particles[0], reused);
    assert.equal(reused.textureUVOffset, 16);
    assert.equal(component.componentQueries, 1);
});

it("interpolates a rotated sprite frame inside an atlas", function rotatedAtlas(t) {
    randomIndex = 1;
    t.mock.method(Math, "random", nextCellRandom);
    const { simulator, buffer, position } = createFixture();
    simulator.sys._renderSpriteFrame.uv = [0.25, 0.25, 0.25, 0.75, 0.75, 0.25, 0.75, 0.75];
    simulator.updateUVs(true);
    simulator.emitParticle(position);
    simulator.updateParticleBuffer(simulator.particles[0], position, buffer, 0);
    assert.deepEqual(readUVs(buffer), [0.25, 0.5, 0.25, 0.75, 0.5, 0.5, 0.5, 0.75]);
});

it("initializes particles already running in the editor preview when enabled", function editorPreview(t) {
    randomIndex = 0;
    t.mock.method(Math, "random", nextCellRandom);
    const { component, simulator, buffer, position } = createFixture();
    component.onDisable();
    simulator.emitParticle(position);
    assert.equal(simulator.particles[0].textureUVOffset, undefined);
    component.onEnable();
    simulator.updateParticleBuffer(simulator.particles[0], position, buffer, 0);
    assert.deepEqual(readUVs(buffer), [0, 1, 0.5, 1, 0, 0.5, 0.5, 0.5]);
});

it("copies cached UVs without reading the source frame or recalculating cells during particle updates", function cachedUpdates(t) {
    randomIndex = 0;
    t.mock.method(Math, "random", nextCellRandom);
    t.mock.method(Math, "floor");
    const { component, simulator, buffer, position } = createFixture();
    simulator.emitParticle(position);
    const frame = simulator.sys._renderSpriteFrame;
    const cached = simulator.tiledUVs;
    const source = simulator.tiledSourceUVs;
    const reads = frame.reads;
    const calculations = Math.floor.mock.calls.length;
    simulator.updateParticleBuffer(simulator.particles[0], position, buffer, 0);
    simulator.updateParticleBuffer(simulator.particles[0], position, buffer, 0);
    assert.equal(frame.reads, reads);
    assert.equal(Math.floor.mock.calls.length, calculations);
    assert.deepEqual(readUVs(buffer), [0, 1, 0.5, 1, 0, 0.5, 0.5, 0.5]);

    simulator.updateUVs(true);
    assert.equal(simulator.uvUpdates, 1);
    assert.equal(Math.floor.mock.calls.length, calculations);
    component.onDisable();
    component.onEnable();
    assert.strictEqual(simulator.tiledUVs, cached);
    assert.strictEqual(simulator.tiledSourceUVs, source);
    assert.equal(component.componentQueries, 1);
});

it("refreshes the same cache when source UVs change in place or a texture loads later", function cacheInvalidation(t) {
    randomIndex = 0;
    t.mock.method(Math, "random", nextCellRandom);
    const { component, simulator, buffer, position } = createFixture();
    simulator.emitParticle(position);
    const cached = simulator.tiledUVs;
    const frame = simulator.sys._renderSpriteFrame;
    frame.values[2] = 0.5;
    frame.values[6] = 0.5;
    simulator.updateUVs(true);
    simulator.updateParticleBuffer(simulator.particles[0], position, buffer, 0);
    assert.deepEqual(readUVs(buffer), [0, 1, 0.25, 1, 0, 0.5, 0.25, 0.5]);
    assert.strictEqual(simulator.tiledUVs, cached);

    component.onDisable();
    simulator.sys._renderSpriteFrame = null;
    component.onEnable();
    simulator.updateParticleBuffer(simulator.particles[0], position, buffer, 0);
    assert.equal(simulator.tiledUVsReady, false);
    simulator.sys._renderSpriteFrame = frame;
    simulator.updateUVs(true);
    assert.equal(simulator.tiledUVsReady, true);
    simulator.updateParticleBuffer(simulator.particles[0], position, buffer, 0);
    assert.deepEqual(readUVs(buffer), [0.25, 1, 0.5, 1, 0.25, 0.5, 0.5, 0.5]);
    assert.strictEqual(simulator.tiledUVs, cached);
});

it("wires the tiled component to TileExplosion and preserves the complete untrimmed sheet", function prefab() {
    const root = new URL("../", import.meta.url);
    const prefab = JSON.parse(readFileSync(new URL("assets/prefabs/TileExplosion.prefab", root)));
    const componentMeta = JSON.parse(readFileSync(new URL("assets/scripts/tiles/TiledParticleTexture.ts.meta", root)));
    const textureMeta = JSON.parse(readFileSync(new URL("assets/textures/item_particles.png.meta", root)));
    const node = prefab[prefab[0].data.__id__];
    const particles = prefab[node._components[0].__id__];
    const tiled = prefab[node._components[1].__id__];
    // Cocos регистрирует классы скриптов по сжатому UUID, как cc._RF в Preview.
    assert.equal(tiled.__type__, compressedUuid(componentMeta.uuid));
    assert.equal(particles.__type__, "cc.ParticleSystem");
    const frame = textureMeta.subMetas.item_particles;
    assert.equal(particles._spriteFrame.__uuid__, frame.uuid);
    assert.equal(frame.trimType, "none");
    assert.equal(frame.trimX, 0);
    assert.equal(frame.trimY, 0);
    assert.equal(frame.width, textureMeta.width);
    assert.equal(frame.height, textureMeta.height);
});
