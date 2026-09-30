/** HTTP persistence boundary. Camera and pose data never cross this module. */
const listeners = new Set();
let authVersion = 0;
const local = ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname);
const baseUrl = (globalThis.MOTION_API_BASE_URL ?? (local ? "http://localhost:3000/api" : "/api")).replace(/\/$/, "");
export function subscribeApi(handler) { listeners.add(handler); return () => listeners.delete(handler); }
function notify(event) {
  for (const handler of listeners) { try { handler(event); } catch { /* UI must not break persistence. */ } }
}
async function request(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body === undefined ? "GET" : "POST", credentials: "include",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) return { ok: false, error: result.error?.message ?? "Не удалось выполнить запрос.",
      code: result.error?.code ?? "HTTP_ERROR", status: response.status };
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, code: error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      error: "Сервер недоступен. Результат тренировки остаётся на экране; сохранение не подтверждено." };
  } finally { clearTimeout(timer); }
}
async function changeAuth(path, body) {
  authVersion += 1;
  notify({ type: "auth-changing" });
  const result = await request(path, body);
  authVersion += 1;
  notify({ type: "auth", result });
  return result;
}
export async function getCurrentUser() {
  const result = await request("/me");
  return result.status === 401 ? { ok: true, data: null } : result;
}
export async function registerUser({ name, email, password }) { return changeAuth("/auth/register", { name, email, password }); }
export async function loginUser({ email, password }) { return changeAuth("/auth/login", { email, password }); }
export async function loginDemoUser() { return changeAuth("/auth/demo", {}); }
export async function logoutUser() { return changeAuth("/auth/logout", {}); }
export async function saveWorkoutResult(result) {
  const version = authVersion;
  notify({ type: "save", status: "pending", id: result.id });
  // Whitelist DTO fields: never serialize arbitrary app state or pose fields.
  const payload = { id: result.id, workoutNumber: result.workoutNumber, programId: result.programId,
    startedAt: result.startedAt, finishedAt: result.finishedAt, durationMs: result.durationMs,
    completed: result.completed, exercises: result.exercises.map(e => ({
      exerciseId: e.exerciseId, targetReps: e.targetReps, completedReps: e.completedReps,
      cleanReps: e.cleanReps, durationMs: e.durationMs,
      errors: e.errors.map(({ rep, code, severity }) => ({ rep, code, severity })),
    })) };
  const saved = await request("/workouts", payload);
  notify({ type: "save", status: saved.ok ? "saved" : "failed", id: result.id, result: saved, stale: version !== authVersion });
  return saved;
}
export async function getWorkoutHistory() {
  const version = authVersion;
  const result = await request("/workouts");
  if (version !== authVersion) return { ok: false, error: "Аккаунт изменился.", code: "STALE_RESPONSE" };
  return result;
}
export async function getUserProgress() { return request("/progress"); }
// Compatibility: progress is derived from workouts, never overwritten by browser totals.
export async function saveUserProgress(_progress) { return getUserProgress(); }
