import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

// Исполняем реальные компоненты без метаданных Inspector и без установки Cocos в Node.
globalThis.cc = {
    Component: class {},
    _decorator: {},
    color(r, g, b, a = 255) { return { r, g, b, a }; },
    Color: { copy(out, color) { Object.assign(out, color); } },
    isValid(value) { return !!value; },
    NodePool: class {
        items = [];
        get() { return this.items.pop() || null; }
        put(node) { this.items[this.items.length] = node; }
    },
    instantiate(prefab) { return prefab.instantiate(); }
};
const modules = new Map();
export async function loadGameModule(relativePath) {
    const file = new URL(relativePath, new URL("../../assets/scripts/", import.meta.url));
    if (modules.has(file.href)) return modules.get(file.href);
    let source = readFileSync(file, "utf8").replace(/^\s*@(?:ccclass|disallowMultiple|(?:property|requireComponent)\([^\n]*\))\s*$/gm, "");
    source = stripTypeScriptTypes(source);
    for (const match of source.matchAll(/from "(\.[^"]+)"/g)) {
        const dependency = new URL(match[1] + ".ts", file);
        const url = await moduleUrl(dependency);
        source = source.replace(match[0], `from "${url}"`);
    }
    const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
    modules.set(file.href, url);
    return url;
}
async function moduleUrl(file) {
    return loadGameModule(file.href);
}
export const { default: SuperTileStrategy } = await import(await loadGameModule("superTiles/SuperTileStrategy.ts"));
export const { default: RowEffectStrategy } = await import(await loadGameModule("superTiles/RowEffectStrategy.ts"));
export const { default: ColumnEffectStrategy } = await import(await loadGameModule("superTiles/ColumnEffectStrategy.ts"));
export const { default: RadiusEffectStrategy } = await import(await loadGameModule("superTiles/RadiusEffectStrategy.ts"));
export const { default: BoardEffectStrategy } = await import(await loadGameModule("superTiles/BoardEffectStrategy.ts"));
