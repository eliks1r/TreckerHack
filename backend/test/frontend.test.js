import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createFrontendServer } from "../scripts/serve-frontend.js";

test("existing frontend modules and MediaPipe assets are served; backend/secrets are excluded", async t => {
  const server = createFrontendServer().listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const index = await fetch(base + "/"); assert.equal(index.status, 200);
  const html = await index.text(); assert.ok(html.includes("./src/main.js")); assert.ok(html.includes("./src/ui3d.js"));
  for (const path of ["/styles.css", "/src/main.js", "/src/ui3d.js", "/src/api.js", "/src/pose.js", "/vendor/mediapipe/vision_bundle.mjs",
    "/vendor/mediapipe/models/pose_landmarker_lite.task", "/vendor/mediapipe/wasm/vision_wasm_internal.wasm"]) {
    const res = await fetch(base + path); assert.equal(res.status, 200, path); await res.arrayBuffer();
  }
  for (const path of ["/backend/package.json", "/.env", "/.git/config", "/src/../backend/src/server.js", "/src/%2e%2e%5cbackend/package.json"]) {
    const res = await fetch(base + path); assert.equal(res.status, 404, path);
  }
});
