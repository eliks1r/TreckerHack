# Integration guide

## Architecture

```text
Camera / MediaPipe
  → smoothed pose and quality
  → exercise analyzers
  → workout controller
  → app state and events
  → UI

Workout result JSON
  → src/api.js
  → Express HTTP API
  → PostgreSQL / Prisma
```

`src/main.js` currently connects these layers. Camera frames stay in the browser. Only a completed, JSON-serializable workout result crosses the API boundary.

## Frontend teammate

Safe places to change the presentation are `index.html`, `styles.css`, and UI rendering in `src/main.js`. Use `PROGRAMS`, `EXERCISE_NAMES`, and `EXERCISE_VIEWS` from `src/programs.js` for labels, targets, and positioning. Use `getAppState()` or `subscribeAppState(handler)` from `src/appState.js` to render a snapshot; `subscribeAppState` calls the handler immediately and returns an unsubscribe function. `on(eventName, handler)` from `src/events.js` also returns an unsubscribe function.

The state snapshot contains:

```js
{
  screen,                 // SPLASH, CALIBRATION, PROGRAMS, INTRO,
                          // EXERCISE_READY, WORKOUT, REST, or RESULTS
  cameraStatus,
  calibration,
  selectedProgram,
  workout,                // controller state and status
  currentExercise,        // { id, targetReps, view } or null
  currentExerciseResult   // analyzer summary or null; never landmarks
}
```

Events for rendering and interaction are `app:screen-change`, `program:selected`, `workout:ready`, `workout:start`, `exercise:ready`, `exercise:start`, `rep`, `exercise:complete`, `workout:rest`, `workout:complete`, `workout:reset`, `camera:error`, and `calibration:complete`. `app:state-change` carries the full snapshot. `CONTRACT.md` lists payloads. Keep START TRAINING and START EXERCISE as distinct user actions; the controller rejects completion before an exercise is ACTIVE. Coordinate any changes to `src/exercises/` recognition algorithms with the motion-engine owner.

## Backend teammate

Replace function bodies inside `src/api.js`. Keep the exported async functions and `{ ok, data }` success shape:

| Function | HTTP operation |
| --- | --- |
| `getCurrentUser()` | GET current authenticated user/session |
| `saveWorkoutResult(result)` | POST one completed workout |
| `getWorkoutHistory()` | GET workout history for the current user |
| `saveUserProgress(progress)` | GET server-derived progress; client totals are ignored |

The adapter now uses credentialed HTTP requests to the separate backend. Existing exports and success shapes are preserved, including registerUser, loginUser, loginDemoUser and logoutUser used by the current UI. HTTP error objects are translated into string errors for compatibility. Anonymous current-user lookup returns null. saveUserProgress reads server-derived totals; there is no client-controlled progress write. getUserProgress and subscribeApi support UI progress/status updates. Failed saves leave Results visible. Do not import api.js from pose or exercise modules. See [backend/README.md](./backend/README.md) for setup and API documentation.

### Workout result JSON

`buildWorkoutResult()` in `src/workout.js` produces the object sent to `saveWorkoutResult()`:

```json
{
  "id": "unique-result-id",
  "workoutNumber": 2,
  "programId": "strength",
  "startedAt": "2026-09-30T10:00:00.000Z",
  "finishedAt": "2026-09-30T10:04:21.000Z",
  "durationMs": 261000,
  "exercises": [
    {
      "exerciseId": "squat",
      "targetReps": 10,
      "completedReps": 10,
      "cleanReps": 8,
      "durationMs": 45000,
      "errors": [{ "rep": 3, "code": "SQ_SHALLOW", "severity": "critical" }]
    }
  ],
  "completed": true
}
```

ISO timestamps use UTC, durations are milliseconds, and `exercises` retains stage order. Workout 3 intentionally contains Arm Raise twice, so do not key stored stages only by `exerciseId`. The result has no DOM nodes, camera frames, or MediaPipe landmarks. `src/main.js` calls `saveWorkoutResult()` after entering RESULTS and catches save failures.

## Dependency rule

Pose modules expose landmarks and quality only. Exercise modules recognize motion only. The workout module orchestrates stages and serializes results. App/UI modules own screen navigation and user interaction. The API module owns persistence. Imports must follow those boundaries without circular dependencies.
