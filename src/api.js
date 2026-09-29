// In-memory adapter only. Replace these function bodies with authenticated
// backend calls when the API is available; keep their async return shapes.
const workoutHistory = [];
let userProgress = null;

export async function getCurrentUser() {
  // TODO(backend): fetch the current user from the authentication/session API.
  return { ok: true, data: null };
}

export async function saveWorkoutResult(result) {
  // TODO(backend): POST the JSON workout result and return the saved record.
  const saved = structuredClone(result);
  workoutHistory.push(saved);
  return { ok: true, data: structuredClone(saved) };
}

export async function getWorkoutHistory() {
  // TODO(backend): fetch paginated workout history for the current user.
  return { ok: true, data: structuredClone(workoutHistory) };
}

export async function saveUserProgress(progress) {
  // TODO(backend): persist progress for the current user.
  userProgress = structuredClone(progress);
  return { ok: true, data: structuredClone(userProgress) };
}
