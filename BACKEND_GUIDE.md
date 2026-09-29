# Backend guide

The backend developer owns persistence behind `src/api.js` and may add a `backend/` application after agreeing on a stack. Existing frontend/core code must communicate with that backend **only through `src/api.js`**. Preserve its async public functions unless frontend and core owners coordinate a contract change:

| Function | Purpose |
| --- | --- |
| `getCurrentUser()` | Current user/session lookup |
| `saveWorkoutResult(result)` | Save one completed workout |
| `getWorkoutHistory()` | Read past workouts |
| `saveUserProgress(progress)` | Save a progress summary |

The current adapter is in memory, returns `{ ok: true, data }`, and makes no network requests. A future failure may reject or return `{ ok: false, error }`; Results must remain visible even when saving fails. Authentication and database choices belong behind this boundary. Keep secrets in environment variables; `.env.example` contains placeholders only.

## Workout result contract

`buildWorkoutResult()` in `src/workout.js` produces JSON like:

```json
{
  "id": "unique-result-id",
  "workoutNumber": 2,
  "programId": "strength",
  "startedAt": "2026-09-30T10:00:00.000Z",
  "finishedAt": "2026-09-30T10:04:00.000Z",
  "durationMs": 240000,
  "exercises": [
    {
      "exerciseId": "squat",
      "targetReps": 10,
      "completedReps": 10,
      "cleanReps": 8,
      "durationMs": 45000,
      "errors": []
    }
  ],
  "completed": true
}
```

Times are ISO 8601 UTC strings; durations are milliseconds. Exercise array order matters because Workout 3 uses Arm Raise twice. Backend receives only JSON-serializable application data. **Never send or store video frames, MediaPipe landmarks, canvas data, or DOM objects.**

Do not import MediaPipe or exercise modules into the backend. Do not modify `src/exercises/**`, `src/pose.js`, `src/calibration.js`, `src/geometry.js`, or `src/engine.js`. If the API contract must change, coordinate it through a Pull Request and update [CONTRACT.md](./CONTRACT.md) with core-owner approval.
