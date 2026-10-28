import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { loadGameModule, SuperTileStrategy, RowEffectStrategy, ColumnEffectStrategy } from "./helpers/CocosComponents.mjs";

const { SuperTileFactory } = await import(await loadGameModule("superTiles/SuperTileFactory.ts"));
function prefab(strategy) {
    strategy.spriteFrame = "sprite";
    return { data: { getComponents(type) { return strategy instanceof type ? [strategy] : []; } },
        instantiate() { throw new Error("Strategy prefabs must never be instantiated."); } };
}

it("reads strategy components without instantiating prefabs or creating pools", function definitions() {
    const row = new RowEffectStrategy(); row.minimumGroupSize = 5;
    const column = new ColumnEffectStrategy(); column.minimumGroupSize = 5;
    const rowPrefab = prefab(row);
    const originalPool = cc.NodePool;
    cc.NodePool = class { constructor() { throw new Error("No extra pools allowed."); } };
    try {
        const factory = new SuperTileFactory([rowPrefab, prefab(column)], 3);
        assert.ok([3, 4].includes(factory.creation.selectTile(5)));
        assert.throws(function duplicate() { new SuperTileFactory([rowPrefab, rowPrefab], 3); });
        assert.throws(function missing() { new SuperTileFactory([null], 3); });
    } finally { cc.NodePool = originalPool; }
});

it("accepts a new strategy component without registration", function extension() {
    class CustomStrategy extends SuperTileStrategy {
        collectTargets(origin, _context, targets) { targets[0] = origin; return 1; }
    }
    const strategy = new CustomStrategy(); strategy.minimumGroupSize = 4;
    const factory = new SuperTileFactory([prefab(strategy)], 3);
    assert.strictEqual(factory.creation.getStrategy(factory.creation.selectTile(4)), strategy);
});

it("scene points to four prefabs with valid strategy UUIDs and migrated settings", function serializedAssets() {
    const scene = JSON.parse(readFileSync(new URL("../assets/scenes/GamePlay.fire", import.meta.url), "utf8"));
    const bootstrap = scene.find(function component(value) { return value && value.superTilePrefabs; });
    assert.equal(bootstrap.superTilePrefabs.length, 4);
    const names = ["Row", "Column", "Radius", "Board"];
    const expectedThresholds = [5, 5, 7, 13];
    for (let i = 0; i < names.length; i++) {
        const asset = new URL(`../assets/prefabs/superTileConfigs/${names[i]}SuperTile.prefab`, import.meta.url);
        const meta = JSON.parse(readFileSync(new URL(asset.href + ".meta"), "utf8"));
        assert.equal(bootstrap.superTilePrefabs[i].__uuid__, meta.uuid);
        const data = JSON.parse(readFileSync(asset, "utf8"));
        const strategy = data.find(function definition(value) { return value.minimumGroupSize !== undefined; });
        assert.equal(strategy.minimumGroupSize, expectedThresholds[i]);
        assert.equal("kind" in strategy, false);
        assert.ok(strategy.spriteFrame.__uuid__);
        assert.equal(data[1]._children.length, 0);
        assert.equal(data[1]._components.length, 1);
        assert.equal(data.some(function sprite(o) { return o.__type__ === "cc.Sprite"; }), false);
        assert.ok(data[1]._components.some(function attached(reference) { return data[reference.__id__] === strategy; }));
        if (names[i] === "Radius") assert.equal(strategy.radius, 1);
    }
});
