import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { it } from "node:test";

// Preserve Cocos extensionless imports in game assets; resolve the single runtime
// dependency explicitly for Node's native TypeScript loader.
const dependency = new URL("../assets/scripts/superTiles/SuperTileStrategies.ts", import.meta.url).href;
const source = readFileSync(new URL("../assets/scripts/superTiles/SuperTileFactory.ts", import.meta.url), "utf8")
    .replace('from "./SuperTileStrategies";', `from "${dependency}";`);
const javascript = stripTypeScriptTypes(source);
const { SuperTileFactory } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

it("registers all four effects and rejects missing registrations", function factory() {
    const rules = [
        { kind: 1, minimumGroupSize: 8 }, { kind: 2, minimumGroupSize: 10 },
        { kind: 3, minimumGroupSize: 12 }, { kind: 4, minimumGroupSize: 15 }
    ];
    const services = SuperTileFactory.create(rules, 1);
    assert.equal(services.creation.selectKind(12), 3);
    const effect = services.effects[3];
    const targets = new Array(9);
    assert.equal(effect.collectTargets(4, { columns: 3, capacity: 9 }, targets), 9);
    assert.strictEqual(services.effects[3], effect);
    assert.throws(function missing() { SuperTileFactory.create([{ kind: 5, minimumGroupSize: 8 }], 1); });
    assert.throws(function badRadius() { SuperTileFactory.create(rules, 0); });
});
