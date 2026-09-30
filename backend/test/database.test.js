import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { workout } from "./helpers/fixtures.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
test("PostgreSQL end-to-end, isolation, transactions and persistence across backend process restart", {
  skip: !databaseUrl && "TEST_DATABASE_URL is required: use a migrated dedicated PostgreSQL test database.", timeout: 90000,
}, async t => {
  const { createDatabase } = await import("../src/db/client.js");
  const { saveWorkout } = await import("../src/services/workouts.js");
  const db = createDatabase(databaseUrl);
  await db.$connect();
  const suffix = randomUUID();
  const emailA = `test-a-${suffix}@example.com`;
  const emailB = `test-b-${suffix}@example.com`;
  const testEmails = [emailA, emailB];
  const secret = randomBytes(48).toString("hex");
  const reserved = createServer().listen(0, "127.0.0.1"); await once(reserved, "listening");
  const port = reserved.address().port; await new Promise(resolve => reserved.close(resolve));
  let child;
  async function start() {
    child = spawn(process.execPath, ["src/server.js"], { cwd: new URL("../", import.meta.url),
      env: { ...process.env, DATABASE_URL: databaseUrl, JWT_SECRET: secret, PORT: String(port),
        FRONTEND_ORIGIN: "http://localhost:8000", NODE_ENV: "test", ENABLE_DEMO_AUTH: "true" }, stdio: ["ignore", "pipe", "pipe"] });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Backend startup timed out")), 15000);
      child.stdout.on("data", data => { if (data.toString().includes("listening")) { clearTimeout(timer); resolve(); } });
      child.once("exit", code => { clearTimeout(timer); reject(new Error(`Backend exited with ${code}; verify database setup`)); });
      child.once("error", error => { clearTimeout(timer); reject(error); });
    });
  }
  async function stop() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exit = once(child, "exit"); child.kill(); await exit;
  }
  t.after(async () => {
    await stop();
    // Delete only accounts created by this test invocation; foreign keys cascade their records.
    await db.user.deleteMany({ where: { email: { in: testEmails } } });
    await db.$disconnect();
  });
  await start();
  const base = `http://127.0.0.1:${port}/api`;
  async function request(path, { method = "GET", body, cookie } = {}) {
    const res = await fetch(base + path, { method, headers: { Origin: "http://localhost:8000",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, json: await res.json(), cookie: res.headers.get("set-cookie")?.split(";")[0], headers: res.headers };
  }
  let cookieA, cookieB, userA;
  const result = workout(`workout-${suffix}`);
  await t.test("health uses PostgreSQL", async () => assert.equal((await request("/health")).status, 200));
  await t.test("registration stores only hash and returns safe user with HttpOnly cookie", async () => {
    const res = await request("/auth/register", { method: "POST", body: { name: "Athlete A", email: emailA.toUpperCase(), password: "test-password-123" } });
    assert.equal(res.status, 201); cookieA = res.cookie; userA = res.json.data;
    assert.equal(userA.email, emailA); assert.equal(userA.name, "Athlete A");
    assert.ok(res.headers.get("set-cookie").includes("HttpOnly"));
    assert.equal(userA.passwordHash, undefined);
    const stored = await db.user.findUnique({ where: { email: emailA } });
    assert.ok(stored.passwordHash.startsWith("scrypt$")); assert.notEqual(stored.passwordHash, "test-password-123");
  });
  await t.test("duplicate registration and wrong password", async () => {
    assert.equal((await request("/auth/register", { method: "POST", body: { name: "Duplicate", email: emailA, password: "test-password-123" } })).status, 409);
    assert.equal((await request("/auth/login", { method: "POST", body: { email: emailA, password: "wrong-password" } })).status, 401);
  });
  await t.test("login, both me endpoints, and anonymous rejection", async () => {
    const res = await request("/auth/login", { method: "POST", body: { email: emailA, password: "test-password-123" } });
    assert.equal(res.status, 200); cookieA = res.cookie;
    for (const path of ["/me", "/auth/me"]) assert.equal((await request(path, { cookie: cookieA })).json.data.id, userA.id);
    assert.equal((await request("/workouts", { method: "POST", body: result })).status, 401);
  });
  await t.test("save result, ordered repeated exercise stages, history and detail", async () => {
    const res = await request("/workouts", { method: "POST", cookie: cookieA, body: result });
    assert.equal(res.status, 201); assert.deepEqual(res.json.data, result);
    assert.deepEqual((await request("/workouts", { cookie: cookieA })).json.data, [result]);
    assert.deepEqual((await request(`/workouts/${result.id}`, { cookie: cookieA })).json.data, result);
  });
  await t.test("invalid payloads return 400 and cannot spoof ownership", async () => {
    for (const patch of [{ durationMs: -1 }, { workoutNumber: 4 }, { completed: "true" }, { startedAt: "invalid" },
      { userId: randomUUID() }, { landmarks: [] }, { exercises: [{ ...result.exercises[0], exerciseId: "clap" }] }]) {
      const res = await request("/workouts", { method: "POST", cookie: cookieA, body: { ...result, ...patch } });
      assert.equal(res.status, 400); assert.equal(res.json.error.code, "VALIDATION_ERROR");
    }
  });
  await t.test("concurrent identical retry is idempotent; changed payload conflicts", async () => {
    const responses = await Promise.all([1, 2].map(() => request("/workouts", { method: "POST", cookie: cookieA, body: result })));
    assert.ok(responses.every(r => r.status === 200));
    assert.equal((await request("/workouts", { method: "POST", cookie: cookieA, body: { ...result, durationMs: 240001 } })).status, 409);
    assert.equal((await request("/workouts", { cookie: cookieA })).json.data.length, 1);
  });
  await t.test("progress is server-derived and includes all four exercises", async () => {
    const p = (await request("/progress", { cookie: cookieA })).json.data;
    assert.equal(p.totalWorkouts, 1); assert.equal(p.totalReps, 26); assert.equal(p.totalDurationMs, 240000);
    assert.equal(p.lastWorkoutAt, result.finishedAt); assert.equal(p.exerciseTotals.armraise.completedReps, 16);
    assert.equal(p.exerciseTotals.pushup.completedReps, 0); assert.equal(p.exerciseTotals.squat.completedReps, 0);
    assert.equal(p.exerciseTotals.sidebend.completedReps, 10);
  });
  await t.test("other user's history/progress are isolated and workout returns 404", async () => {
    const b = await request("/auth/register", { method: "POST", body: { name: "Athlete B", email: emailB, password: "test-password-123" } });
    assert.equal(b.status, 201); cookieB = b.cookie;
    assert.deepEqual((await request("/workouts", { cookie: cookieB })).json.data, []);
    assert.equal((await request(`/workouts/${result.id}`, { cookie: cookieB })).status, 404);
    assert.equal((await request("/progress", { cookie: cookieB })).json.data.totalWorkouts, 0);
  });
  await t.test("exercise errors survive round trip and history is newest first", async () => {
    const withErrors = { ...workout(`errors-${suffix}`), workoutNumber: 1, programId: "full-body",
      startedAt: "2026-10-01T10:00:00.000Z", finishedAt: "2026-10-01T10:04:00.000Z",
      exercises: [{ exerciseId: "squat", targetReps: 8, completedReps: 8, cleanReps: 7, durationMs: 60000,
        errors: [{ rep: 3, code: "SQ_SHALLOW", severity: "critical" }] }] };
    assert.deepEqual((await request("/workouts", { method: "POST", cookie: cookieA, body: withErrors })).json.data, withErrors);
    assert.equal((await request("/workouts", { cookie: cookieA })).json.data[0].id, withErrors.id);
  });
  await t.test("transaction rolls back workout/exercises when progress fails", async () => {
    const failingDb = { $transaction: callback => db.$transaction(tx => callback(new Proxy(tx, {
      get(target, key) { if (key === "userProgress") return { findUnique: target.userProgress.findUnique.bind(target.userProgress),
        upsert: async () => { throw new Error("Injected failure"); } }; return Reflect.get(target, key); },
    }))) };
    const failedId = `rollback-${suffix}`;
    await assert.rejects(() => saveWorkout(failingDb, userA.id, workout(failedId)), /Injected failure/);
    assert.equal(await db.workoutSession.count({ where: { userId: userA.id, resultId: failedId } }), 0);
  });
  await t.test("restart actual backend process, log in again, verify persisted workouts/progress", async () => {
    await stop(); await start();
    const login = await request("/auth/login", { method: "POST", body: { email: emailA, password: "test-password-123" } });
    assert.equal(login.status, 200); cookieA = login.cookie;
    const history = (await request("/workouts", { cookie: cookieA })).json.data;
    assert.equal(history.length, 2); assert.deepEqual(history.find(w => w.id === result.id), result);
    const progress = (await request("/progress", { cookie: cookieA })).json.data;
    assert.equal(progress.totalWorkouts, 2); assert.equal(progress.totalReps, 34);
    const cached = await db.userProgress.findUnique({ where: { userId: userA.id } });
    assert.equal(cached.totalWorkouts, 2); assert.equal(Number(cached.totalReps), 34);
  });
  await t.test("logout revokes session even if old cookie is replayed", async () => {
    assert.equal((await request("/auth/logout", { method: "POST", cookie: cookieA })).status, 200);
    assert.equal((await request("/me", { cookie: cookieA })).status, 401);
  });
  await t.test("demo sessions are separate accounts and expired sessions cannot be replayed", async () => {
    const demoA = await request("/auth/demo", { method: "POST" });
    const demoB = await request("/auth/demo", { method: "POST" });
    assert.equal(demoA.status, 201); assert.equal(demoB.status, 201);
    testEmails.push(demoA.json.data.email, demoB.json.data.email);
    assert.notEqual(demoA.json.data.id, demoB.json.data.id);
    const reused = await request("/auth/demo", { method: "POST", cookie: demoA.cookie });
    assert.equal(reused.status, 200); assert.equal(reused.json.data.id, demoA.json.data.id);
    await db.authSession.updateMany({ where: { userId: demoA.json.data.id }, data: { expiresAt: new Date(0) } });
    assert.equal((await request("/me", { cookie: demoA.cookie })).status, 401);
    assert.equal((await request("/me", { cookie: demoB.cookie })).status, 200);
  });
});
