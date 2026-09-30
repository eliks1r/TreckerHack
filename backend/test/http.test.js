import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";

test("HTTP middleware returns JSON, checks origins and works without database identity", async t => {
  // Only a health probe stub: persistence/auth behavior is tested against PostgreSQL separately.
  const db = { $queryRaw: async () => [{ value: 1 }] };
  const server = createApp({ db, config: { origin: "http://localhost:8000", secret: "x".repeat(32), production: false, demo: false } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/api/workouts", "/api/progress", "/api/me", "/api/auth/me", "/api/workouts/other"]) {
    const res = await fetch(base + path); assert.equal(res.status, 401); assert.equal((await res.json()).error.code, "UNAUTHENTICATED");
  }
  let res = await fetch(base + "/api/health", { headers: { Origin: "http://localhost:8000" } });
  assert.equal(res.status, 200); assert.equal(res.headers.get("access-control-allow-credentials"), "true");
  assert.equal((await res.json()).data.database, "connected");
  res = await fetch(base + "/api/health", { headers: { Origin: "https://evil.example" } });
  assert.equal(res.status, 403); assert.equal((await res.json()).error.code, "ORIGIN_DENIED");
  res = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(res.status, 400); assert.equal((await res.json()).error.code, "INVALID_JSON");
  res = await fetch(base + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(res.status, 400); assert.equal((await res.json()).error.code, "VALIDATION_ERROR");
  res = await fetch(base + "/api/auth/demo", { method: "POST" }); assert.equal(res.status, 403);
  res = await fetch(base + "/api/unknown"); assert.equal(res.status, 404); assert.equal((await res.json()).ok, false);
  db.$queryRaw = async () => { throw new Error("Unavailable"); };
  res = await fetch(base + "/api/health"); assert.equal(res.status, 503); assert.equal((await res.json()).error.code, "DATABASE_UNAVAILABLE");
});
