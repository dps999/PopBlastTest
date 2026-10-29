import assert from "node:assert/strict";
import { it } from "node:test";
import { readFileSync } from "node:fs";
import { loadGameModule } from "./helpers/CocosComponents.mjs";

const { default: BombExplosionPool } = await import(await loadGameModule("tiles/BombExplosionPool.ts"));
const { default: Tile } = await import(await loadGameModule("tiles/Tile.ts"));

class Particles {
    stopped = true;
    particleCount = 0;
    resets = 0;
    startColor = { r: 240, g: 235, b: 230, a: 220 };
    endColor = { r: 210, g: 205, b: 200, a: 0 };
    node = {
        active: true, parent: null, x: 0, y: 0, destroyed: false, destroying: false, lookups: 0, destroys: 0,
        setPosition(x, y) { this.x = x; this.y = y; },
        destroy() {
            if (this.destroyed || this.destroying) { throw new Error("object already destroyed"); }
            this.destroys++;
            this.destroyed = true;
        }
    };
    constructor() { this.node.particles = this; this.node.getComponent = getParticles; }
    resetSystem() { this.resets++; this.stopped = false; }
}

function getParticles() { this.lookups++; return this.particles; }
function instantiateExplosion() { this.created++; return new Particles().node; }

function isValidEffect(value, strict) {
    return !!value && !value.destroyed && (!strict || !value.destroying);
}

function fixture() {
    const pool = new BombExplosionPool();
    pool.node = {};
    pool.capacity = 2;
    pool.tileCapacity = 2;
    pool.tileExplosionPrefab = { created: 0, instantiate: instantiateExplosion };
    pool.explosionPrefab = { created: 0, instantiate: instantiateExplosion };
    pool.onLoad();
    return pool;
}

it("prewarms once, rejects exhaustion and reuses nodes, component references and buffers", function reuse() {
    const pool = fixture();
    const available = pool.bombs.available;
    const active = pool.bombs.active;
    const first = available[1];
    const second = available[0];
    assert.equal(pool.explosionPrefab.created, 2);
    assert.equal(first.node.parent, pool.node);
    assert.equal(first.node.active, false);
    assert.equal(first.playOnLoad, false);
    assert.equal(first.autoRemoveOnFinish, false);
    assert.equal(pool.play(pool.explosionPrefab, 10, 20), true);
    assert.strictEqual(pool.bombs.active[0], first);
    assert.equal(first.node.x, 10);
    assert.equal(first.node.y, 20);
    assert.equal(pool.play(pool.explosionPrefab, 30, 40), true);
    assert.equal(pool.play(pool.explosionPrefab, 50, 60), false);
    second.stopped = true;
    pool.update();
    assert.equal(second.node.active, false);
    assert.equal(pool.play(pool.explosionPrefab, 70, 80), true);
    assert.strictEqual(pool.bombs.active[1], second);
    assert.equal(second.node.x, 70);
    assert.equal(second.node.y, 80);
    assert.equal(second.resets, 2);
    assert.equal(pool.explosionPrefab.created, 2);
    assert.strictEqual(pool.bombs.available, available);
    assert.strictEqual(pool.bombs.active, active);
    assert.equal(first.node.lookups, 1);
    assert.equal(second.node.lookups, 1);
});

it("returns an effect only after emission and all particles finish, then destroys owned effects", function lifetime() {
    const pool = fixture();
    const idle = pool.bombs.available[0];
    pool.play(pool.explosionPrefab, 0, 0);
    const effect = pool.bombs.active[0];
    pool.update();
    assert.equal(pool.bombs.activeCount, 1);
    effect.stopped = true;
    effect.particleCount = 1;
    pool.update();
    assert.equal(pool.bombs.activeCount, 1);
    effect.particleCount = 0;
    pool.update();
    assert.equal(pool.bombs.activeCount, 0);
    assert.equal(pool.bombs.availableCount, 2);
    pool.play(pool.explosionPrefab, 5, 6);
    pool.onDestroy();
    assert.equal(effect.node.destroyed, true);
    assert.equal(idle.node.destroyed, true);
    assert.equal(pool.play(pool.explosionPrefab, 1, 2), false);
});

it("keeps bomb and tile pools separate and stays busy until both are finished", function bothPools() {
    const pool = fixture();
    assert.equal(pool.isPlaying, false);
    assert.equal(pool.play(pool.explosionPrefab, 1, 2), true);
    assert.equal(pool.play(pool.tileExplosionPrefab, 3, 4), true);
    assert.equal(pool.isPlaying, true);
    const bomb = pool.bombs.active[0];
    const tile = pool.tiles.active[0];
    assert.notStrictEqual(bomb, tile);
    assert.equal(bomb.node.zIndex, 1);
    assert.equal(tile.node.zIndex, 0);
    tile.stopped = true;
    pool.update();
    assert.equal(pool.tiles.availableCount, 2);
    assert.equal(pool.bombs.availableCount, 1);
    assert.equal(pool.isPlaying, true);
    bomb.stopped = true;
    bomb.particleCount = 1;
    pool.update();
    assert.equal(pool.isPlaying, true);
    bomb.particleCount = 0;
    pool.update();
    assert.equal(pool.bombs.availableCount, 2);
    assert.equal(pool.isPlaying, false);
});

it("retints tile effects without new color objects and restores defaults on reuse", function tileTint() {
    const pool = fixture();
    const effect = pool.tiles.available[1];
    const start = effect.startColor;
    const end = effect.endColor;
    const color = { r: 50, g: 100, b: 150, a: 20 };
    assert.equal(pool.play(pool.tileExplosionPrefab, 7, 8, color), true);
    assert.strictEqual(effect.startColor, start);
    assert.strictEqual(effect.endColor, end);
    assert.deepEqual(start, { r: 50, g: 100, b: 150, a: 220 });
    assert.deepEqual(end, { r: 50, g: 100, b: 150, a: 255 });
    assert.equal(color.a, 20);
    effect.stopped = true;
    pool.update();
    assert.equal(pool.play(pool.tileExplosionPrefab, 9, 10), true);
    assert.strictEqual(pool.tiles.active[0], effect);
    assert.deepEqual(start, { r: 240, g: 235, b: 230, a: 220 });
    assert.deepEqual(end, { r: 210, g: 205, b: 200, a: 255 });
    assert.equal(pool.tileExplosionPrefab.created, 2);
    assert.equal(effect.node.lookups, 1);
});

it("cleans references after Cocos has already destroyed the child particle components", function parentDestruction(t) {
    t.mock.method(cc, "isValid", isValidEffect);
    const pool = fixture();
    pool.play(pool.explosionPrefab, 0, 0);
    pool.play(pool.tileExplosionPrefab, 0, 0);
    const effects = [pool.bombs.available[0], pool.bombs.active[0], pool.tiles.available[0], pool.tiles.active[0]];
    const bombs = pool.bombs;
    const tiles = pool.tiles;
    for (let i = 0; i < effects.length; i++) {
        effects[i].destroyed = true;
        effects[i].node = null;
    }
    pool.onDestroy();
    pool.onDestroy();
    assert.equal(pool.bombs, null);
    assert.equal(pool.tiles, null);
    assert.equal(bombs.available[0], null);
    assert.equal(bombs.active[0], null);
    assert.equal(tiles.available[0], null);
    assert.equal(tiles.active[0], null);
    assert.equal(pool.isPlaying, false);
    assert.equal(pool.play(pool.explosionPrefab, 0, 0), false);
    assert.equal(pool.play(pool.tileExplosionPrefab, 0, 0), false);
});

it("does not destroy nodes twice, including nodes already queued for destruction", function queuedDestruction(t) {
    t.mock.method(cc, "isValid", isValidEffect);
    const pool = fixture();
    pool.play(pool.explosionPrefab, 0, 0);
    const queued = pool.bombs.active[0].node;
    const destroyed = pool.tiles.available[1].node;
    const live = pool.tiles.available[0].node;
    queued.destroying = true;
    destroyed.destroyed = true;
    pool.onDestroy();
    pool.onDestroy();
    assert.equal(queued.destroys, 0);
    assert.equal(destroyed.destroys, 0);
    assert.equal(live.destroys, 1);
});

function read(relative) { return JSON.parse(readFileSync(new URL("../" + relative, import.meta.url))); }

it("uses the effect selected by prefab and rejects effects outside the warmed pools", function selectedPrefab() {
    const pool = fixture();
    const unknown = {};
    assert.equal(pool.play(unknown, 0, 0), false);
    assert.equal(pool.bombs.availableCount, 2);
    assert.equal(pool.tiles.availableCount, 2);
    assert.equal(pool.play(pool.tileExplosionPrefab, 1, 2), true);
    assert.equal(pool.tiles.activeCount, 1);
    assert.equal(pool.bombs.activeCount, 0);
    assert.equal(pool.play(pool.explosionPrefab, 3, 4), true);
    assert.equal(pool.bombs.activeCount, 1);
});

it("uses Tile's default effect and resets a strategy override when a tile is reused", function defaultEffect() {
    const tile = new Tile();
    tile.sprite = { spriteFrame: null };
    const normal = {};
    const bomb = {};
    tile.defaultDestructionParticles = normal;
    assert.strictEqual(tile.destructionParticles, normal);
    tile.setSprite("bomb", bomb);
    assert.strictEqual(tile.destructionParticles, bomb);
    tile.setSprite("normal");
    assert.strictEqual(tile.destructionParticles, normal);
});

function hasDefaultParticles(value) { return value.defaultDestructionParticles !== undefined; }

it("assigns default tile particles and bomb overrides in strategy prefab configs", function effectConfigs() {
    const normal = read("assets/prefabs/TileExplosion.prefab.meta").uuid;
    const bomb = read("assets/prefabs/BombExplosion.prefab.meta").uuid;
    const tile = read("assets/prefabs/Tile.prefab").find(hasDefaultParticles);
    assert.equal(tile.defaultDestructionParticles.__uuid__, normal);
    const names = ["Row", "Column", "Radius", "Board"];
    for (let i = 0; i < names.length; i++) {
        const strategy = read("assets/prefabs/superTileConfigs/" + names[i] + "SuperTile.prefab")[2];
        assert.equal(strategy.destructionParticles.__uuid__, i < 2 ? normal : bomb);
    }
    assert.equal(read("assets/prefabs/boosters/BombBooster.prefab")[3].destructionParticles.__uuid__, bomb);
});

it("provides a separate larger explosion and a ready standalone pool prefab", function assets() {
    const base = read("assets/prefabs/TileExplosion.prefab");
    const explosion = read("assets/prefabs/BombExplosion.prefab");
    const explosionMeta = read("assets/prefabs/BombExplosion.prefab.meta");
    const pool = read("assets/prefabs/BombExplosionPool.prefab");
    const component = pool[pool[1]._components[0].__id__];
    assert.equal(component.explosionPrefab.__uuid__, explosionMeta.uuid);
    assert.equal(component.capacity, 16);
    assert.equal(component.tileExplosionPrefab.__uuid__, read("assets/prefabs/TileExplosion.prefab.meta").uuid);
    assert.ok(explosion[2].totalParticles > base[2].totalParticles);
    assert.ok(explosion[2].startSize > base[2].startSize);
    assert.ok(explosion[2].speed > base[2].speed);
    assert.deepEqual(explosion[2]._spriteFrame, base[2]._spriteFrame);
    assert.equal(explosion[3].__type__, base[3].__type__);
    assert.equal(explosion[2].playOnLoad, false);
    assert.equal(explosion[2].autoRemoveOnFinish, false);
});
