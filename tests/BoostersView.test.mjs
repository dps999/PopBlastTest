import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { loadGameModule } from "./helpers/CocosComponents.mjs";

const { default: BoosterButton } = await import(await loadGameModule("boosters/BoosterButton.ts"));
const { default: BoostersView } = await import(await loadGameModule("boosters/BoostersView.ts"));
const { BoosterFactory } = await import(await loadGameModule("boosters/BoosterFactory.ts"));

function button() {
    const value = new BoosterButton();
    value.node = {
        subscriptions: [], color: null,
        on(event, method, target) { this.subscriptions[this.subscriptions.length] = { event, method, target }; },
        off(event, method, target) {
            this.subscriptions = this.subscriptions.filter(function keep(item) {
                return item.event !== event || item.method !== method || item.target !== target;
            });
        }
    };
    value.quantityLabel = { string: "3" }; value.button = { interactable: true };
    return value;
}

it("common button displays only quantity, highlights selection and unsubscribes on destroy", function buttonLifecycle() {
    const value = button(); const chosen = [];
    const listener = { selectBooster(index) { chosen[chosen.length] = index; } };
    value.init(listener, 1); value.init(listener, 1);
    assert.equal(value.node.subscriptions.length, 1);
    value.render(3, true, true);
    assert.equal(value.quantityLabel.string, "3"); assert.equal(value.button.interactable, true);
    assert.deepEqual(value.node.color, { r: 255, g: 225, b: 100, a: 255 });
    value.onClick(); assert.deepEqual(chosen, [1]);
    value.render(0, false, false); value.onClick();
    assert.equal(value.quantityLabel.string, "0"); assert.equal(value.button.interactable, false);
    assert.deepEqual(chosen, [1]);
    value.onDestroy(); assert.equal(value.node.subscriptions.length, 0);
});

it("view wires every registered definition and disposes its controller", function viewLifecycle() {
    const view = new BoostersView(); view.buttons = [button(), button(), button()];
    const controller = { disposed: false, selectBooster() {}, dispose() { this.disposed = true; } };
    view.init(controller, 3); view.renderButton(2, 4, true, true);
    assert.equal(view.buttons[2].quantityLabel.string, "4");
    assert.equal(view.buttons[2].index, 2);
    assert.throws(function wrongCount() { view.init(controller, 2); });
    view.onDestroy(); assert.equal(controller.disposed, true);
});

function read(relative) { return JSON.parse(readFileSync(new URL("../" + relative, import.meta.url), "utf8")); }
function compressed(uuid) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const hex = uuid.replaceAll("-", ""); let result = hex.slice(0, 5);
    for (let i = 5; i < 32; i += 3) { const value = parseInt(hex.slice(i, i + 3), 16); result += alphabet[value >> 6] + alphabet[value & 63]; }
    return result;
}

it("scene contains two linked button instances, configured stock and exact component UUIDs", function serializedButtons() {
    const scene = read("assets/scenes/GamePlay.fire");
    const prefab = read("assets/prefabs/BoosterButton.prefab");
    const uuid = read("assets/prefabs/BoosterButton.prefab.meta").uuid;
    const buttonType = compressed(read("assets/scripts/boosters/BoosterButton.ts.meta").uuid);
    const viewType = compressed(read("assets/scripts/boosters/BoostersView.ts.meta").uuid);
    const layout = scene.find(function find(value) { return value._name === "BoostersLayout"; });
    const view = scene.find(function find(value) { return value.__type__ === viewType; });
    const bootstrap = scene.find(function find(value) { return value.superTilePrefabs; });
    assert.equal(layout._children.length, 2); assert.equal(view.buttons.length, 2);
    assert.strictEqual(scene[bootstrap.boostersView.__id__], view);
    assert.equal(bootstrap.config.bombBoosterCount, 3); assert.equal(bootstrap.config.teleportBoosterCount, 3);
    assert.equal(bootstrap.config.boosterBombRadius, 1);
    for (let i = 0; i < 2; i++) {
        const node = scene[layout._children[i].__id__]; const component = scene[view.buttons[i].__id__];
        assert.equal(scene[node._prefab.__id__].asset.__uuid__, uuid);
        assert.equal(component.__type__, buttonType); assert.strictEqual(scene[component.node.__id__], node);
        assert.equal(scene[component.button.__id__].__type__, "cc.Button");
        assert.equal(scene[component.quantityLabel.__id__]._string, "3");
        const icon = scene[component.icon.__id__];
        if (i === 0) assert.equal(icon._spriteFrame.__uuid__, read("assets/textures/Blocks/block_bomb.png.meta").subMetas.block_bomb.uuid);
        else assert.equal(icon._spriteFrame, null);
    }
    assert.equal(prefab.filter(function labels(value) { return value.__type__ === "cc.Label"; }).length, 1);
    assert.equal(prefab.find(function component(value) { return value.__type__ === buttonType; }).quantityLabel.__id__, 6);
    const definitions = BoosterFactory.createDefinitions(9, 81, 1, 3, 3);
    assert.equal(definitions.length, 2); assert.equal(definitions[0].effect.targetCount, 1); assert.equal(definitions[1].effect.targetCount, 2);
    for (const objects of [scene, prefab]) {
        const check = function references(value) {
            if (!value || typeof value !== "object") return;
            if (Object.hasOwn(value, "__id__")) assert.ok(Number.isInteger(value.__id__) && value.__id__ >= 0 && value.__id__ < objects.length);
            for (const key of Object.keys(value)) check(value[key]);
        };
        check(objects);
    }
});
