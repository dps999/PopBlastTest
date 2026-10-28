import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { loadGameModule } from "./helpers/CocosComponents.mjs";

const { default: BoosterButton } = await import(await loadGameModule("boosters/BoosterButton.ts"));
const { default: BoostersView } = await import(await loadGameModule("boosters/BoostersView.ts"));
const { BoosterFactory } = await import(await loadGameModule("boosters/BoosterFactory.ts"));
const { default: BoosterConfig } = await import(await loadGameModule("boosters/BoosterConfig.ts"));
const { default: BoosterEffectStrategy } = await import(await loadGameModule("boosters/BoosterEffectStrategy.ts"));
const { default: BombBoosterStrategy } = await import(await loadGameModule("boosters/BombBoosterStrategy.ts"));
const { default: TeleportBoosterStrategy } = await import(await loadGameModule("boosters/TeleportBoosterStrategy.ts"));

class ButtonNode {
    subscriptions = [];
    color = null;
    component = null;
    on(event, method, target) { this.subscriptions[this.subscriptions.length] = { event, method, target }; }
    off(event, method, target) {
        for (let i = this.subscriptions.length - 1; i >= 0; i--) {
            const item = this.subscriptions[i];
            if (item.event === event && item.method === method && item.target === target) this.subscriptions.splice(i, 1);
        }
    }
    getComponent(type) { return type === BoosterButton ? this.component : null; }
    set parent(value) { value.children[value.children.length] = this; }
}

function button() {
    const value = new BoosterButton();
    value.node = new ButtonNode();
    value.node.component = value;
    value.icon = { spriteFrame: null };
    value.quantityLabel = { string: "3" };
    value.button = { interactable: true };
    return value;
}

class ButtonsParent {
    children = [];
    layoutUpdates = 0;
    get childrenCount() { return this.children.length; }
    getComponent() { return this; }
    updateLayout() { this.layoutUpdates++; }
}

it("common button displays its icon and quantity, highlights selection and unsubscribes on destroy", function buttonLifecycle() {
    const value = button(); const chosen = [];
    const listener = { selectBooster(index) { chosen[chosen.length] = index; } };
    value.init(listener, 1, "teleport"); value.init(listener, 1, "teleport");
    assert.equal(value.node.subscriptions.length, 1);
    assert.equal(value.icon.spriteFrame, "teleport");
    value.render(3, true, true);
    assert.equal(value.quantityLabel.string, "3"); assert.equal(value.button.interactable, true);
    assert.deepEqual(value.node.color, { r: 255, g: 225, b: 100, a: 255 });
    value.onClick(); assert.deepEqual(chosen, [1]);
    value.render(0, false, false); value.onClick();
    assert.equal(value.quantityLabel.string, "0"); assert.equal(value.button.interactable, false);
    assert.deepEqual(chosen, [1]);
    value.onDestroy(); assert.equal(value.node.subscriptions.length, 0);
});

it("view reuses buttons and each button releases its own subscriptions on destroy", function viewLifecycle() {
    const view = new BoostersView();
    const first = button(); const second = button();
    view.node = new ButtonsParent();
    view.node.children = [first.node, second.node];
    view.initialButtons = [first];
    view.buttonPrefab = { instantiate() { return button().node; } };
    const controller = { selections: 0, selectBooster() { this.selections++; } };
    const definitions = [{ icon: "bomb" }, { icon: "teleport" }, { icon: "custom" }];
    view.init(controller, definitions); view.renderButton(2, 4, true, true);
    assert.strictEqual(view.buttons[0], first); assert.strictEqual(view.buttons[1], second);
    assert.equal(view.buttons[2].quantityLabel.string, "4");
    assert.equal(view.buttons[2].index, 2);
    assert.deepEqual(view.buttons.map(iconOf), ["bomb", "teleport", "custom"]);
    assert.equal(view.node.childrenCount, 3); assert.equal(view.node.layoutUpdates, 1);
    const third = view.buttons[2];
    first.onDestroy(); second.onDestroy(); third.onDestroy();
    assert.equal(first.node.subscriptions.length, 0);
    assert.equal(second.node.subscriptions.length, 0);
    assert.equal(third.node.subscriptions.length, 0);
    first.onClick(); second.onClick(); third.onClick();
    assert.equal(controller.selections, 0);
});

function iconOf(value) { return value.icon.spriteFrame; }
function read(relative) { return JSON.parse(readFileSync(new URL("../" + relative, import.meta.url), "utf8")); }
function compressed(uuid) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const hex = uuid.replaceAll("-", ""); let result = hex.slice(0, 5);
    for (let i = 5; i < 32; i += 3) { const value = parseInt(hex.slice(i, i + 3), 16); result += alphabet[value >> 6] + alphabet[value & 63]; }
    return result;
}

class DefinitionPrefab {
    constructor(config, effect) { this.config = config; this.effect = effect; this.data = this; }
    getComponents(type) {
        if (type === BoosterConfig) return [this.config];
        if (type === BoosterEffectStrategy) return [this.effect];
        return [];
    }
    getComponentsInChildren() { return []; }
    instantiate() { throw new Error("Booster definitions must not be instantiated."); }
}

function validateReferences(value, objects) {
    if (!value || typeof value !== "object") return;
    if (Object.hasOwn(value, "__id__")) assert.ok(Number.isInteger(value.__id__) && value.__id__ >= 0 && value.__id__ < objects.length);
    for (const key of Object.keys(value)) validateReferences(value[key], objects);
}

it("scene links button and strategy prefabs with configured stock, icons and exact component UUIDs", function serializedButtons() {
    const scene = read("assets/scenes/GamePlay.fire");
    const prefab = read("assets/prefabs/ui/BoosterButton.prefab");
    const uuid = read("assets/prefabs/ui/BoosterButton.prefab.meta").uuid;
    const buttonType = compressed(read("assets/scripts/boosters/BoosterButton.ts.meta").uuid);
    const viewType = compressed(read("assets/scripts/boosters/BoostersView.ts.meta").uuid);
    const configType = compressed(read("assets/scripts/boosters/BoosterConfig.ts.meta").uuid);
    const layout = scene.find(function find(value) { return value._name === "BoostersLayout"; });
    const view = scene.find(function find(value) { return value.__type__ === viewType; });
    const bootstrap = scene.find(function find(value) { return value.superTilePrefabs; });
    assert.equal(layout._children.length, 2); assert.equal(view.initialButtons.length, 2);
    assert.strictEqual(scene[bootstrap.boostersView.__id__], view);
    assert.equal(view.buttonPrefab.__uuid__, uuid);
    assert.equal(bootstrap.boosterPrefabs.length, 2);
    const names = ["Bomb", "Teleport"];
    const effects = [new BombBoosterStrategy(), new TeleportBoosterStrategy()];
    const prefabs = new Array(2);
    const expectedIcons = [
        read("assets/textures/Blocks/block_bomb.png.meta").subMetas.block_bomb.uuid,
        read("assets/textures/Hud/icon_booster_teleport.png.meta").subMetas.icon_booster_teleport.uuid
    ];
    const configuredButton = button();
    const listener = { selectBooster() {} };
    for (let i = 0; i < names.length; i++) {
        const path = `assets/prefabs/boosters/${names[i]}Booster.prefab`;
        const data = read(path);
        assert.equal(bootstrap.boosterPrefabs[i].__uuid__, read(path + ".meta").uuid);
        const effectType = compressed(read(`assets/scripts/boosters/${names[i]}BoosterStrategy.ts.meta`).uuid);
        const config = new BoosterConfig();
        let serializedEffect = null;
        for (const reference of data[1]._components) {
            const component = data[reference.__id__];
            if (component.__type__ === configType) { config.initialCount = component.initialCount; config.icon = component.icon; }
            if (component.__type__ === effectType) serializedEffect = component;
        }
        assert.ok(serializedEffect);
        assert.equal(data[1]._components.length, 2);
        assert.equal(data.some(function sprite(value) { return value.__type__ === "cc.Sprite"; }), false);
        assert.equal(config.initialCount, 3);
        if (i === 0) { effects[i].radius = serializedEffect.radius; assert.equal(effects[i].radius, 1); }
        prefabs[i] = new DefinitionPrefab(config, effects[i]);
        validateReferences(data, data);
        const node = scene[layout._children[i].__id__]; const component = scene[view.initialButtons[i].__id__];
        assert.equal(scene[node._prefab.__id__].asset.__uuid__, uuid);
        assert.equal(component.__type__, buttonType); assert.strictEqual(scene[component.node.__id__], node);
        assert.equal(scene[component.button.__id__].__type__, "cc.Button");
        assert.equal(scene[component.quantityLabel.__id__]._string, "3");
        const icon = scene[component.icon.__id__];
        assert.equal(icon.__type__, "cc.Sprite");
        assert.equal(config.icon.__uuid__, expectedIcons[i]);
        // При запуске конфиг заменяет изображение, сохранённое в сцене.
        configuredButton.icon.spriteFrame = icon._spriteFrame;
        configuredButton.init(listener, i, config.icon);
        assert.strictEqual(configuredButton.icon.spriteFrame, config.icon);
    }
    configuredButton.dispose();
    assert.equal(prefab.filter(function labels(value) { return value.__type__ === "cc.Label"; }).length, 1);
    const buttonComponent = prefab.find(function component(value) { return value.__type__ === buttonType; });
    assert.equal(prefab[buttonComponent.quantityLabel.__id__].__type__, "cc.Label");
    const definitions = BoosterFactory.createDefinitions(prefabs);
    assert.equal(definitions.length, 2); assert.equal(definitions[0].effect.targetCount, 1); assert.equal(definitions[1].effect.targetCount, 2);
    assert.strictEqual(definitions[0].effect, effects[0]); assert.strictEqual(definitions[1].effect, effects[1]);
    assert.equal(definitions[0].initialCount, 3); assert.equal(definitions[1].initialCount, 3);
    assert.deepEqual(definitions[0].icon, prefabs[0].config.icon);
    validateReferences(scene, scene); validateReferences(prefab, prefab);
});
