# Motion Quest contracts

This is the application boundary contract. [INTEGRATION.md](./INTEGRATION.md) explains how teammates can use it.

## Architecture and module boundaries

`camera → MediaPipe raw landmarks → One Euro smoothing → pose quality and calibration → exercise analyzer → workout controller → app state/events → UI`

Workout results follow a separate path: `workout controller → result serializer → api.js → future backend`.

| Layer | Modules | Owns | Must not own |
| --- | --- | --- | --- |
| Pose | `camera.js`, `pose.js`, `filter.js`, `poseQuality.js`, `calibration.js`, `geometry.js` | Camera lifecycle, landmarks, smoothing, visibility, view, calibration | Workout screens, accounts, APIs |
| Exercise | `exercises/squat.js`, `armraise.js`, `sidebend.js`, `pushup.js`, `engine.js` | Recognition, phases, repetition/form results, `rep` and `hint` events | DOM, network, storage, program progression |
| Workout | `programs.js`, `workout.js` | Program data, explicit session transitions, serializable result | Camera frames, MediaPipe, DOM |
| App/UI | `appState.js`, `events.js`, `main.js`, `index.html`, `styles.css`, `drawPose.js` | Screens, buttons, feedback, event subscriptions | Recognition thresholds inside UI |
| API | `api.js` | Async persistence boundary | Pose data, exercise recognition, DOM |

Dependencies flow from the UI into the workout and exercise layers. The analyzer modules do not import `api.js`, access `localStorage`, manipulate DOM, or know about accounts. No video frames or landmarks enter workout result objects.

## Programs

`PROGRAMS` contains exactly three numbered workouts, each with `{ workoutNumber, id, name, shortName, description, durationMinutes, exercises }`. Each exercise is `{ id, targetReps }`.

| Number | ID | Exercises |
| --- | --- | --- |
| 1 | `full-body` | Squat 8, Arm Raise 8, Side Bend 10 |
| 2 | `strength` | Squat 10, Push-up 5, Arm Raise 10 |
| 3 | `light` | Arm Raise 8, Side Bend 10, Arm Raise 8 |

Exercise IDs are `squat`, `armraise`, `sidebend`, and `pushup`. `EXERCISE_VIEWS` supplies positioning text for the UI. The active analyzer's `view` remains the recognition requirement.

## Application and workout states

The outer application state is `SPLASH` or `CAMERA`. Inside CAMERA, `appState.screen` is `CALIBRATION`, `PROGRAMS`, `INTRO`, `EXERCISE_READY`, `WORKOUT`, `REST`, or `RESULTS`. Camera and pose resources stay active between these views and stop on return to SPLASH.

`createWorkout(program)` owns `{ workoutNumber, programId, currentExerciseIndex, status, exerciseResults, startedAt, finishedAt }`. Valid statuses and transitions are:

```text
IDLE → PROGRAM_SELECTED → READY → EXERCISE_READY → ACTIVE
                                               ↑            ↓
                                               └── REST ←───┘
ACTIVE → COMPLETE  (after the final exercise)
```

`selectProgram()` enters `PROGRAM_SELECTED`; `readyWorkout()` enters `READY` and displays the intro. START TRAINING calls `startWorkout()` and enters `EXERCISE_READY`. START EXERCISE calls `startExercise()` and enters `ACTIVE`; only then does `main.js` feed pose frames to the analyzer. `completeCurrentExercise()` records the target and enters REST or COMPLETE. PREPARE NEXT EXERCISE calls `readyNextExercise()` and enters `EXERCISE_READY`; it does not start recognition. Returning to workouts or repeating calls `resetWorkout()` and clears analyzer state. Repeat selects the same program and returns to its intro.

The REST timer is a 20-second display; it does not activate an analyzer. Every exercise instance, including the second Arm Raise in Workout 3, starts with a fresh analyzer.

## Exercise analyzer output

Each factory returns `{ id, view, analyze(landmarks, context), reset() }`. The engine feeds **smoothed** landmarks and context with `videoWidth`, `videoHeight`, monotonic `nowMs`, current view/framing, and calibration. Results have:

```js
{
  visible: true,
  phase: "up",
  reps: 1,
  cleanReps: 1,
  errors: [],                    // { code, severity, joints } when implemented
  repEvent: null,               // or { counted, clean, errors, durationMs, minAngle? }
  metrics: {}                   // exercise-specific, no landmarks or DOM nodes
}
```

Squat and Push-up require SIDE view; Arm Raise and Side Bend require FRONT view. Squat uses a pixel-corrected knee angle and currently classifies `SQ_KNEE_TOE`, `SQ_LEAN`, `SQ_SHALLOW`, `SQ_NOT_UP`, and `SQ_FAST`. Arm Raise uses normalized bilateral wrist height; Side Bend uses pixel-corrected torso lateral angle; Push-up uses a pixel-corrected elbow angle. The latter three return empty `errors` until form checks are implemented. All four use confirmed phase transitions and reject incomplete cycles. Push-up validates its own side-profile joints so standing framing cannot block a horizontal body.

## Result contract

`buildWorkoutResult(workout.getState())` returns JSON with no MediaPipe objects:

```json
{
  "id": "uuid-or-local-id",
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

Timestamps are ISO 8601 strings; durations are integer milliseconds. Repeated exercise IDs remain separate array entries in program order. `api.js` currently stores results only in memory. A failed future save must not block RESULTS.

## App state and event contract

`getAppState()` returns a cloned snapshot with `{ screen, cameraStatus, calibration, selectedProgram, workout, currentExercise, currentExerciseResult }`. `subscribeAppState(handler)` immediately gives a snapshot and returns an unsubscribe function. `app:state-change` also publishes each snapshot. `app:screen-change` publishes `{ screen, previousScreen }`. UI consumers may use `on(name, handler)` from `events.js`; they should not read analyzer closure state.

| Event | Payload |
| --- | --- |
| `program:selected` | Workout session in `PROGRAM_SELECTED` |
| `workout:ready`, `workout:start` | Workout session snapshot |
| `exercise:ready`, `exercise:start` | `{ programId, exerciseId, index, targetReps, view? }` |
| `rep` | `{ exercise, rep, clean, errors, durationMs, minAngle? }` |
| `exercise:complete` | `{ programId, exerciseId, reps, targetReps, result }` |
| `workout:rest` | `{ programId, seconds, nextExerciseId }` |
| `workout:complete` | Serialized workout result |
| `workout:reset` | `{ programId }` |
| `camera:error`, `calibration:complete` | Normalized camera error; completed calibration object |

Existing `camera:*`, `pose:*`, `calibration:*`, and `hint` events remain in place. Pose landmarks stay in the pose event stream and never enter `appState` or API results.

## Error states

Camera errors are `CAMERA_DENIED`, `NO_CAMERA`, and `CAMERA_ERROR`; pose initialization errors include `MODEL_FAILED`. Pose quality returns `NO_BODY`, `PARTIAL_BODY`, `TOO_CLOSE`, or `READY`, plus `FRONT`, `SIDE`, or `UNKNOWN` view. Exercise analysis pauses on invalid view or required joint loss and clears incomplete cycles after the tracking timeout. UI positioning guidance has priority over exercise form hints.
