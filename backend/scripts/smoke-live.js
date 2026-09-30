// Checks the existing browser UI against the running API and actual application database.
// Creates and cleans up only one uniquely named verification account; never logs secrets.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { chromium } from "playwright-core";
import { createDatabase } from "../src/db/client.js";

const env = dotenv.parse(await readFile(new URL("../.env", import.meta.url), "utf8"));
const executablePath = process.env.BROWSER_EXECUTABLE ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
if (!existsSync(executablePath)) throw new Error("Set BROWSER_EXECUTABLE to an installed Chromium browser.");
const email = `live-check-${randomUUID()}@example.com`;
const password = randomBytes(24).toString("hex");
const db = createDatabase(env.DATABASE_URL);
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
  await page.goto("http://localhost:8000", { waitUntil: "networkidle" });
  await page.click("#btn-open-signup");
  await page.fill("#reg-name", "Live verification athlete");
  await page.fill("#reg-email", email);
  await page.fill("#reg-password", password);
  await page.fill("#reg-confirm-password", password);
  await page.click("#btn-submit-register");
  await page.locator("#user-profile-menu").waitFor({ state: "visible" });
  await page.locator("#auth-modal").waitFor({ state: "hidden" });
  assert.ok((await page.context().cookies()).some(cookie => cookie.name === "motion_session" && cookie.httpOnly));
  const response = await page.evaluate(async () => {
    const { PROGRAMS } = await import("./src/programs.js");
    const { createWorkout, buildWorkoutResult } = await import("./src/workout.js");
    const api = await import("./src/api.js");
    const program = PROGRAMS[2];
    const session = createWorkout(program);
    const start = Date.now() - 240000;
    session.selectProgram(); session.readyWorkout(); session.startWorkout(start);
    for (let i = 0; i < program.exercises.length; i++) {
      const exercise = program.exercises[i];
      session.startExercise(start + i * 70000);
      session.completeCurrentExercise({ reps: exercise.targetReps, cleanReps: exercise.targetReps, errors: [] }, start + i * 70000 + 60000);
      if (i < program.exercises.length - 1) session.readyNextExercise();
    }
    const result = buildWorkoutResult(session.getState());
    const saved = await api.saveWorkoutResult(result);
    const history = await api.getWorkoutHistory();
    const progress = await api.getUserProgress();
    return { result, saved, history, progress };
  });
  assert.equal(response.saved.ok, true);
  assert.deepEqual(response.saved.data, response.result);
  assert.deepEqual(response.history.data, [response.result]);
  assert.equal(response.progress.data.totalWorkouts, 1);
  assert.equal(response.progress.data.totalReps, 26);
  await page.waitForFunction(() => document.querySelectorAll("#history-items-list .history-item").length === 1);
  assert.ok((await page.locator("#user-progress-summary").textContent()).includes("26"));
  assert.equal(await db.workoutSession.count({ where: { user: { email } } }), 1);
  await page.click("#user-profile-btn"); await page.click("#btn-logout");
  await page.locator("#auth-buttons-group").waitFor({ state: "visible" });
  assert.equal(await page.locator("#history-items-list .history-item").count(), 0);
  assert.deepEqual(errors, []);
  console.log("Live browser/API/PostgreSQL check passed: registration, HttpOnly session, actual WorkoutResult serializer, save, history, progress, logout. No API fixtures.");
} catch (error) {
  console.error(`Live check failed (${error.code ?? error.name}); credentials were not printed.`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
}
