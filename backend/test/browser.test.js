import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { once } from "node:events";
import { chromium } from "playwright-core";
import { createFrontendServer } from "../scripts/serve-frontend.js";
import { workout } from "./helpers/fixtures.js";

const executablePath = process.env.BROWSER_EXECUTABLE ?? (process.platform === "win32"
  ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" : "");
test("real browser loads existing app, handles offline auth/save and updates account-specific history", {
  skip: !existsSync(executablePath) && "Set BROWSER_EXECUTABLE to an installed Chromium browser.", timeout: 45000,
}, async t => {
  const server = createFrontendServer().listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const browser = await chromium.launch({ executablePath, headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Test camera denied", "NotAllowedError"); };
  });
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
  let offline = true;
  let loggedIn = false;
  const fixture = workout("browser-workout");
  // HTTP fixtures verify UI contracts only. Real persistence/auth are covered by database.test.js.
  await page.route("http://localhost:3000/api/**", async route => {
    if (offline) return route.abort();
    const path = new URL(route.request().url()).pathname;
    const user = { id: "browser-user", name: "Browser Athlete", email: "browser@example.com" };
    let status = 200, data;
    if (path === "/api/auth/register") { loggedIn = true; data = user; status = 201; }
    else if (path === "/api/auth/logout") { loggedIn = false; data = null; }
    else if (!loggedIn) status = 401;
    else if (path === "/api/me") data = user;
    else if (path === "/api/workouts") data = [fixture];
    else if (path === "/api/progress") data = { totalWorkouts: 1, totalReps: 26, totalDurationMs: 240000 };
    await route.fulfill({ status, contentType: "application/json",
      body: JSON.stringify(status === 401 ? { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in" } } : { ok: true, data }) });
  });
  await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("#splash-screen").isVisible(), true);
  assert.equal(await page.locator("#program-cards .program-card").count(), 3);
  assert.equal(await page.locator("#history-items-list .history-item").count(), 0);
  await page.click("#btn-open-login");
  await page.fill("#login-email", "browser@example.com"); await page.fill("#login-password", "test-password");
  await page.click("#btn-submit-login");
  await page.waitForFunction(() => document.querySelector("#auth-alert").textContent.includes("Сервер недоступен"));
  await page.click("#btn-login-demo");
  await page.waitForFunction(() => document.querySelector("#auth-alert").textContent.includes("Сервер недоступен"));
  await page.click("#auth-modal-close");
  const saved = await page.evaluate(async result => (await import("./src/api.js")).saveWorkoutResult(result), fixture);
  assert.equal(saved.ok, false);
  assert.ok((await page.locator("#workout-save-status").textContent()).includes("не сохранена"));
  // Motion controls still respond when backend is offline; camera denial is handled by existing core.
  await page.click("#start-button");
  await page.waitForFunction(() => document.querySelector("#camera-status").textContent.includes("blocked"));
  assert.equal(await page.locator("#camera-screen").isVisible(), true);
  await page.click("#back-button");
  assert.equal(await page.locator("#splash-screen").isVisible(), true);
  offline = false;
  await page.click("#btn-open-signup");
  await page.fill("#reg-name", "Browser Athlete"); await page.fill("#reg-email", "browser@example.com");
  await page.fill("#reg-password", "test-password"); await page.fill("#reg-confirm-password", "test-password");
  await page.click("#btn-submit-register");
  await page.locator("#user-profile-menu").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelectorAll("#history-items-list .history-item").length === 1);
  assert.ok((await page.locator("#history-items-list").textContent()).includes("26"));
  assert.ok((await page.locator("#user-progress-summary").textContent()).includes("26"));
  await page.locator("#auth-modal").waitFor({ state: "hidden" });
  await page.click("#user-profile-btn"); await page.click("#btn-logout");
  await page.locator("#auth-buttons-group").waitFor({ state: "visible" });
  assert.equal(await page.locator("#history-items-list .history-item").count(), 0);
  assert.equal(await page.locator("#user-progress-summary").textContent(), "");
  assert.deepEqual(errors, []);
});
