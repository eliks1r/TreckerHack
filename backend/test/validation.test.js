import test from "node:test";
import assert from "node:assert/strict";
import { workoutSchema } from "../src/validation/workout.js";
import { registerSchema } from "../src/validation/auth.js";
import { workout } from "./helpers/fixtures.js";
import { hashPassword, verifyPassword } from "../src/services/auth.js";
import { readConfig } from "../src/config/env.js";

test("accepts actual repeated exercise DTO and normalizes registration email", () => {
  assert.deepEqual(workoutSchema.parse(workout()), workout());
  assert.equal(registerSchema.parse({ name: " Athlete ", email: " ATHLETE@EXAMPLE.COM ", password: "password123" }).email, "athlete@example.com");
});
test("rejects invalid workouts without accepting video/ownership metadata", () => {
  for (const patch of [{ workoutNumber: 4 }, { workoutNumber: 1 }, { programId: "unknown" },
    { durationMs: -1 }, { durationMs: 0.5 }, { completed: "true" }, { startedAt: "yesterday" },
    { finishedAt: "2026-09-29T10:00:00.000Z" }, { exercises: [] }, { userId: "other" }, { landmarks: [] }, { id: "../escape" }]) {
    assert.equal(workoutSchema.safeParse({ ...workout(), ...patch }).success, false, JSON.stringify(patch));
  }
  for (const patch of [{ exerciseId: "clap" }, { targetReps: -1 }, { completedReps: -1 }, { cleanReps: 9 },
    { durationMs: -1 }, { errors: [{ rep: 1, code: "SQ_SHALLOW", severity: "critical" }] }, { skeleton: [] }]) {
    const data = workout(); data.exercises[0] = { ...data.exercises[0], ...patch };
    assert.equal(workoutSchema.safeParse(data).success, false);
  }
});
test("scrypt stores salted hashes and rejects wrong passwords", async () => {
  const first = await hashPassword("test-password");
  const second = await hashPassword("test-password");
  assert.notEqual(first, second);
  assert.ok(!first.includes("test-password"));
  assert.equal(await verifyPassword("test-password", first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
  assert.equal(await verifyPassword("test-password", "plaintext"), false);
});
test("configuration refuses missing credentials and production demo", () => {
  assert.throws(() => readConfig({}));
  assert.throws(() => readConfig({ DATABASE_URL: "file:test", JWT_SECRET: "short" }));
  assert.throws(() => readConfig({ DATABASE_URL: "postgresql://configured", JWT_SECRET: "x".repeat(32), NODE_ENV: "production" }));
  assert.equal(readConfig({ DATABASE_URL: "postgresql://configured", JWT_SECRET: "x".repeat(32),
    NODE_ENV: "production", FRONTEND_ORIGIN: "https://motion.example", ENABLE_DEMO_AUTH: "true" }).demo, false);
});
