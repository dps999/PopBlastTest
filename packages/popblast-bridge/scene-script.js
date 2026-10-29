'use strict';

var MAX_SCENE_DEPTH = 32;
var MAX_SCENE_NODES = 5000;

function findNode(path) {
    var scene;
    var current;
    var start;
    var end;
    var segment;

    if (typeof path !== 'string' || path.length === 0 || path.length > 512) {
        return null;
    }

    scene = cc.director.getScene();
    if (!scene) {
        return null;
    }

    current = scene;
    start = 0;
    end = path.indexOf('/');
    segment = end === -1 ? path : path.substring(0, end);
    if (segment === scene.name) {
        if (end === -1) {
            return scene;
        }
        start = end + 1;
    }

    while (start < path.length) {
        end = path.indexOf('/', start);
        segment = end === -1 ? path.substring(start) : path.substring(start, end);
        if (segment.length === 0) {
            return null;
        }
        current = current.getChildByName(segment);
        if (!current) {
            return null;
        }
        if (end === -1) {
            return current;
        }
        start = end + 1;
    }

    return current;
}

function serializeNode(node, depth, budget) {
    var result;
    var children;
    var index;

    if (!node || depth > MAX_SCENE_DEPTH || budget.count >= MAX_SCENE_NODES) {
        return null;
    }

    budget.count += 1;
    result = {
        name: node.name,
        active: node.active,
        position: { x: node.x, y: node.y, z: node.z },
        rotation: node.rotation,
        scale: { x: node.scaleX, y: node.scaleY },
        children: []
    };

    children = node.children;
    for (index = 0; index < children.length; index += 1) {
        result.children[index] = serializeNode(children[index], depth + 1, budget);
    }

    return result;
}

function reply(event, error, result) {
    if (event && event.reply) {
        if (error) {
            event.reply(new Error(error), null);
        } else {
            event.reply(null, result);
        }
    }
}

function getScene(event) {
    var scene = cc.director.getScene();
    if (!scene) {
        reply(event, 'No scene is open', null);
        return;
    }

    reply(event, null, serializeNode(scene, 0, { count: 0 }));
}

function createNode(event, payload) {
    var scene = cc.director.getScene();
    var parent;
    var node;

    if (!scene) {
        reply(event, 'No scene is open', null);
        return;
    }
    if (!payload || typeof payload.name !== 'string' || payload.name.length === 0 || payload.name.length > 100 || payload.name.indexOf('/') !== -1) {
        reply(event, 'name must be a non-empty path-safe string up to 100 characters', null);
        return;
    }

    parent = payload.parentPath ? findNode(payload.parentPath) : scene;
    if (!parent) {
        reply(event, 'Parent node was not found', null);
        return;
    }

    node = new cc.Node(payload.name);
    parent.addChild(node);
    reply(event, null, serializeNode(node, 0, { count: 0 }));
}

function updateNode(event, payload) {
    var node;
    var changes;
    var keys;
    var index;
    var key;
    var value;

    if (!payload || !payload.path || !payload.changes || typeof payload.changes !== 'object' || Array.isArray(payload.changes)) {
        reply(event, 'Expected path and changes object', null);
        return;
    }

    node = findNode(payload.path);
    if (!node) {
        reply(event, 'Node was not found', null);
        return;
    }

    changes = payload.changes;
    keys = Object.keys(changes);
    for (index = 0; index < keys.length; index += 1) {
        key = keys[index];
        value = changes[key];

        if (!(key === 'name' && typeof value === 'string' && value.length > 0 && value.length <= 100 && value.indexOf('/') === -1) &&
            !(key === 'active' && typeof value === 'boolean') &&
            !((key === 'x' || key === 'y' || key === 'scaleX' || key === 'scaleY' || key === 'rotation') && typeof value === 'number' && isFinite(value))) {
            reply(event, 'Invalid or unsupported property: ' + key, null);
            return;
        }
    }

    for (index = 0; index < keys.length; index += 1) {
        key = keys[index];
        value = changes[key];
        node[key] = value;
    }

    reply(event, null, serializeNode(node, 0, { count: 0 }));
}

module.exports = {
    'get-scene': getScene,
    'create-node': createNode,
    'update-node': updateNode
};
