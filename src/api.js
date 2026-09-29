/**
 * BACKEND INTEGRATION BOUNDARY
 * Backend work should normally stay in this module or a future backend/ app.
 * Keep these public async function signatures and { ok, data } responses stable;
 * coordinate contract changes with frontend and motion/core owners.
 * This implementation is in-memory only and makes no network requests.
 */
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
