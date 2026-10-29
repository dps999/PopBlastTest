# PopBlast Cocos bridge

This Cocos Creator 2.4 extension exposes a small HTTP API on `127.0.0.1:47651`.
It is intended for local tools that need to inspect and make basic edits to the
currently open scene.

After adding this package, reload extensions or reopen the project in Cocos
Creator. The editor console should report that the bridge is listening.

## API

`GET /health` reports whether the extension is running.

`POST /rpc` accepts a JSON object with one of these operations:

- `{ "op": "scene.get" }` returns the open scene tree.
- `{ "op": "node.create", "name": "Example", "parentPath": "Canvas" }` creates a node. Omit `parentPath` to add it to the scene root.
- `{ "op": "node.update", "path": "Canvas/Example", "changes": { "x": 20, "active": true } }` changes a node's name, active state, position, scale, or rotation.
- `{ "op": "scene.save" }` saves the current scene.

Example:

```sh
curl http://127.0.0.1:47651/health
curl -X POST http://127.0.0.1:47651/rpc \
  -H 'Content-Type: application/json' \
  -d '{"op":"scene.get"}'
```

The server binds only to the loopback interface, accepts only JSON POST
requests without a browser `Origin`, limits request bodies to 64 KiB, and
exposes only the operations listed above.
