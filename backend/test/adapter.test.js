import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { workout } from "./helpers/fixtures.js";

test("browser API preserves exports, handles failure and sends only result DTO", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const source = await readFile(new URL("../../src/api.js", import.meta.url), "utf8");
  const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  for (const name of ["getCurrentUser", "registerUser", "loginUser", "loginDemoUser", "logoutUser", "saveWorkoutResult", "getWorkoutHistory", "saveUserProgress"]) assert.equal(typeof api[name], "function");
  let captured;
  globalThis.fetch = async (url, options) => { captured = { url, options }; return Response.json({ ok: true, data: workout() }); };
  const events = [];
  const unsubscribe = api.subscribeApi(event => events.push(event));
  const result = await api.saveWorkoutResult({ ...workout(), landmarks: ["private"], video: "private", userId: "spoofed" });
  assert.deepEqual(result, { ok: true, data: workout() });
  assert.deepEqual(JSON.parse(captured.options.body), workout());
  assert.equal(captured.options.credentials, "include");
  assert.deepEqual(events.map(e => e.status), ["pending", "saved"]);
  globalThis.fetch = async () => Response.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in" } }, { status: 401 });
  assert.deepEqual(await api.getCurrentUser(), { ok: true, data: null });
  assert.equal((await api.loginUser({ email: "x", password: "y" })).error, "Sign in");
  globalThis.fetch = async () => { throw new Error("offline"); };
  assert.equal((await api.saveWorkoutResult(workout())).code, "NETWORK_ERROR");
  assert.equal(events.at(-1).status, "failed");
  globalThis.fetch = async () => { throw Object.assign(new Error("timeout"), { name: "AbortError" }); };
  assert.equal((await api.getWorkoutHistory()).code, "TIMEOUT");
  globalThis.fetch = async () => new Response("HTML error", { status: 502 });
  assert.equal((await api.getWorkoutHistory()).ok, false);
  unsubscribe();
});

test("history requests from a previous account are discarded", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const source = await readFile(new URL("../../src/api.js", import.meta.url), "utf8");
  const api = await import(`data:text/javascript;base64,${Buffer.from(source + "\n// race test").toString("base64")}`);
  let finishHistory;
  globalThis.fetch = (url) => url.endsWith("/workouts")
    ? new Promise(resolve => { finishHistory = resolve; })
    : Promise.resolve(Response.json({ ok: true, data: null }));
  const pending = api.getWorkoutHistory();
  await api.logoutUser();
  finishHistory(Response.json({ ok: true, data: [workout()] }));
  assert.equal((await pending).code, "STALE_RESPONSE");
});
