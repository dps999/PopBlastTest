'use strict';

var http = require('http');
var PACKAGE_NAME = 'popblast-bridge';
var HOST = '127.0.0.1';
var PORT = 47651;
var MAX_BODY_LENGTH = 65536;
var server = null;
var activeResponse = null;

function writeJson(response, statusCode, body) {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify(body));
}

function onHttpRequest(request, response) {
    var host = request.headers.host || '';
    if (host !== HOST + ':' + PORT && host !== 'localhost:' + PORT) {
        writeJson(response, 403, { error: 'Invalid Host header' });
        return;
    }

    if (request.method === 'GET' && request.url === '/health') {
        writeJson(response, 200, {
            ok: true,
            name: PACKAGE_NAME,
            host: HOST,
            port: PORT
        });
        return;
    }

    if (request.method !== 'POST' || request.url !== '/rpc') {
        writeJson(response, 404, { error: 'Use GET /health or POST /rpc' });
        return;
    }

    if (request.headers.origin) {
        writeJson(response, 403, { error: 'Browser-origin requests are not allowed' });
        return;
    }

    if (!request.headers['content-type'] || request.headers['content-type'].indexOf('application/json') !== 0) {
        writeJson(response, 415, { error: 'Content-Type must be application/json' });
        return;
    }

    request._bridgeResponse = response;
    request._bridgeBody = '';
    request._bridgeTooLarge = false;
    request.on('data', onRequestChunk);
    request.on('end', onRequestEnd);
}

function onRequestChunk(chunk) {
    if (this._bridgeTooLarge) {
        return;
    }

    if (this._bridgeBody.length + chunk.length > MAX_BODY_LENGTH) {
        this._bridgeTooLarge = true;
        writeJson(this._bridgeResponse, 413, { error: 'Request body is too large' });
        return;
    }

    this._bridgeBody += chunk.toString('utf8');
}

function onRequestEnd() {
    var payload;
    if (this._bridgeTooLarge) {
        return;
    }

    try {
        payload = JSON.parse(this._bridgeBody);
    } catch (error) {
        writeJson(this._bridgeResponse, 400, { error: 'Invalid JSON body' });
        return;
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.op !== 'string') {
        writeJson(this._bridgeResponse, 400, { error: 'Expected a JSON object with an op field' });
        return;
    }

    dispatch(payload, this._bridgeResponse);
}

function dispatch(payload, response) {
    var method;
    if (activeResponse) {
        writeJson(response, 429, { error: 'Another bridge request is still running' });
        return;
    }

    if (payload.op === 'scene.get') {
        method = 'get-scene';
    } else if (payload.op === 'node.create') {
        method = 'create-node';
    } else if (payload.op === 'node.update') {
        method = 'update-node';
    } else if (payload.op === 'scene.save') {
        saveScene(response);
        return;
    } else {
        writeJson(response, 400, { error: 'Unsupported operation' });
        return;
    }

    activeResponse = response;
    Editor.Scene.callSceneScript(PACKAGE_NAME, method, payload, onSceneScriptResponse);
}

function saveScene(response) {
    if (activeResponse) {
        writeJson(response, 429, { error: 'Another bridge request is still running' });
        return;
    }

    activeResponse = response;
    Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save', onSaveResponse);
}

function onSceneScriptResponse(error, result) {
    if (error) {
        finishRequest(400, { error: error.message || String(error) });
        return;
    }

    finishRequest(200, { ok: true, result: result });
}

function onSaveResponse(error) {
    if (error) {
        finishRequest(500, { error: error.message || String(error) });
        return;
    }

    finishRequest(200, { ok: true, saved: true });
}

function finishRequest(statusCode, body) {
    var response = activeResponse;
    activeResponse = null;
    if (response && !response.finished) {
        writeJson(response, statusCode, body);
    }
}

function onServerListening() {
    Editor.log('[popblast-bridge] Listening on http://' + HOST + ':' + PORT);
}

function onServerError(error) {
    Editor.error('[popblast-bridge] ' + error.message);
}

function load() {
    if (server) {
        return;
    }

    server = http.createServer(onHttpRequest);
    server.on('listening', onServerListening);
    server.on('error', onServerError);
    server.listen(PORT, HOST);
}

function unload() {
    if (!server) {
        return;
    }

    server.close();
    server = null;
    activeResponse = null;
}

module.exports = {
    load: load,
    unload: unload
};
