# Motion Quest contracts

This document defines the interfaces between modules. The current training flow adds program selection, session state, rest, and results around the existing squat analyzer. Game progression remains planned.

## Architecture and module boundaries

The pipeline is `camera → MediaPipe raw landmarks → One Euro smoothing → pose quality and view → neutral calibration → squat analyzer → engine event → UI`. MediaPipe supplies landmark positions; Motion Quest code owns movement analysis, phase detection, form checks, and corrective feedback.

| Module | Responsibility | Status |
| --- | --- | --- |
| `index.html`, `styles.css` | Accessible application shell and visual design | Implemented |
| `src/config.js` | Shared state, event names, and camera/pose settings | Implemented |
| `src/events.js` | In-process `on(name, handler)` and `emit(name, detail)`; `on` returns an unsubscribe function | Implemented |
| `src/main.js` | Screen routing, status UI, and resource lifecycle | Splash and camera implemented |
| `src/camera.js` | Browser permission, video stream, track cleanup, normalized camera errors | Implemented |
| `src/pose.js` | MediaPipe initialization, GPU to CPU fallback, one inference per video frame | Implemented |
| `src/filter.js` | Independent One Euro x/y filters per landmark; resets on tracking loss | Implemented |
| `src/geometry.js` | Small pixel-corrected distance and angle helpers | Implemented |
| `src/poseQuality.js` | Body visibility, framing, distance, and view codes | Implemented |
| `src/calibration.js` | Stable 1.5-second neutral-stance sample window | Implemented |
| `src/drawPose.js` | Transparent canvas skeleton aligned to the mirrored video; readiness colors | Implemented |
| `src/exercises/squat.js` | Pixel-corrected squat phases, repetition validation, and form classification | Implemented |
| `src/engine.js` | Own active analyzer, feed frames, publish `rep` and throttled `hint` events, reset exercise | Implemented |
| `src/programs.js` | Program data and exercise display names; unavailable exercises remain explicit | Implemented |
| `src/workout.js` | DOM-free workout session state and result transitions | Implemented |

No module should send video frames off device. The UI receives state and engine events, rather than reading pose internals directly.

## Application states

| State | Meaning | Entry |
| --- | --- | --- |
| `SPLASH` | Initial screen with project title, privacy line, and START | App load or Back |
| `CAMERA` | Live webcam, pose tracking, framing guidance, calibration, squat test, or camera error | START |
| `CALIBRATION` | Possible future separate calibration screen; G2.2 calibrates inside CAMERA | Planned |
| `QUEST_SELECT` | Future motion-driven selection | Planned |
| `ACTIVE` | Future movement session | Planned |
| `PAUSED` | Future interruption or user pause | Planned |
| `RESULTS` | Future session summary | Planned |
| `ERROR` | Future recoverable or fatal issue screen | Planned |

Transitions are owned by `src/main.js` (or a future state controller). `SPLASH ↔ CAMERA` remains the application state transition. Within CAMERA, the UI has calibration, programs, workout, rest, unavailable exercise, and results views; switching among them keeps the camera and pose loop running. A state change emits `app:state-changed` with `{ state }`. Returning to Splash stops the pose loop, closes the landmarker, stops every camera track, resets smoothing, session, and calibration.

## Training program and workout contracts

`PROGRAMS` is an array of data objects with `{ id, name, description, durationMinutes, mode, developmentAvailable, exercises }`. Each exercise has `{ id, targetReps, implemented }`. IDs are `squat`, `armraise`, `sidebend`, `pushup`, and `clap`. Only Full Body Beginner is selectable in development mode. Desk Mode and Strength are visible and disabled. Within Full Body Beginner only Squat is implemented; the following Arm Raise stage is a clearly marked placeholder.

`createWorkout(program)` owns `{ programId, currentExerciseIndex, status, exerciseResults, startedAt, endedAt }`. Status is `IDLE`, `ACTIVE`, `REST`, or `COMPLETE`. `startWorkout()` enters ACTIVE only when the first exercise is implemented. `completeCurrentExercise({ reps, cleanReps })` accepts an implemented ACTIVE exercise only after its target is met, records one result, and enters REST or COMPLETE. `nextExercise()` advances only from REST. `finishWorkout()` ends a partial development session; `resetWorkout()` clears all session data. No method reads or writes the DOM. The engine uses an exercise factory registry containing only `squat` for now; unavailable exercise IDs cannot start an analyzer.

The UI listens for a counted `rep` from the squat engine, displays `reps / targetReps`, and completes the stage as soon as the target is reached. It resets the analyzer before showing REST, so further camera frames cannot add reps. The REST timer is 20 seconds and the user may press NEXT EXERCISE. Results show actual completed exercises, completed count, elapsed time, and a development status. No unimplemented stage receives synthetic results.

## Pose quality and calibration contract

`assessPoseQuality(landmarks, videoWidth, videoHeight)` receives **smoothed** normalized landmarks and returns `{ bodyDetected, fullBodyVisible, upperBodyVisible, missingJoints, framing, view, metrics }`. `framing` is one of `NO_BODY`, `PARTIAL_BODY`, `TOO_CLOSE`, or `READY`; `view` is `FRONT`, `SIDE`, or `UNKNOWN`. `metrics` includes normalized body height and pixel-corrected shoulder width, torso length, and their ratio. Framing takes priority over calibration, but the view label does not block calibration by itself.

`createCalibration().update(landmarks, quality, nowMs, videoWidth, videoHeight)` returns `{ state, progress, resetReason?, calibration? }`. It samples a visible neutral stance for 1500 ms while shoulder and hip midpoint drift stays under configured limits. `state` is `WAITING`, `READY`, `CALIBRATING`, or `CALIBRATED`. A completed result is `{ theta0, sw0, torsoLen, legLen, timestamp, derived: { up, start } }`; lengths are in video pixels and `theta0` is in degrees. Invalid framing or movement resets progress during calibration. Once complete, `src/main.js` keeps that calibration for the current camera session while pose quality continues to gate exercise analysis.

## Squat analyzer output contract

`createSquat(config)` exposes `id`, `view`, `analyze(landmarks, context)`, and `reset()`. `landmarks` are smoothed MediaPipe points or `null`. `context` includes `videoWidth`, `videoHeight`, monotonic `nowMs`, current `view`, `framing`, and the calibration result. The selected side has the better average shoulder/hip/knee/ankle visibility among usable sides. The knee angle uses pixel-corrected coordinates.

```js
{
  visible: true,                 // false when required joints cannot be trusted
  phase: "up",                  // up | down | bottom | rising
  reps: 0,                      // total counted repetitions
  cleanReps: 0,                 // counted reps without critical form errors
  errors: [],                   // live or just-completed { code, severity, joints }
  repEvent: null,               // or { counted, clean, errors, durationMs, minAngle }
  metrics: {                    // available for debug, not all shown in UI
    kneeAngle: null,
    minKneeAngle: null,
    kneeOver: null,
    lean: null,
    maxKneeOver: null,
    maxLean: null,
    selectedSide: "LEFT",
    upThreshold: 160,
    downStartThreshold: 145,
    phase: "up",
    phaseCandidate: null,
    phaseConfirmFrames: 0
  }
}
```

`repEvent` is non-null only when a complete phase cycle returns to UP. `counted: false` means the duration was outside 500–10000 ms; the total does not change. A bend that never reaches BOTTOM creates no `repEvent`. A repetition must pass UP → DOWN → BOTTOM → RISING → UP with three confirming frames per phase. A view change away from SIDE cancels the in-progress cycle. Missing landmarks freeze it briefly and cancel it after the configured tracking-loss period. The analyzer never increments while `visible` is false. A counted rep is clean when no critical error is assigned; minor warnings do not lower `cleanReps`.

`SQ_KNEE_TOE` uses the selected side's knee, ankle, and foot index (toe proxy). Forward is the ankle-to-toe horizontal direction; knee displacement beyond the toe is divided by calibrated leg length in pixels. Three consecutive near-bottom samples above 0.06 produce a minor warning; above 0.12 produce a critical error. `SQ_LEAN` is the shoulder-to-hip angle from vertical, critical above 55° for three near-bottom samples. A completed rep with minimum knee angle in (100°, 125°] gets critical `SQ_SHALLOW`. Duration below 900 ms gets minor `SQ_FAST`. Holding 145°–160° for over 1500 ms while rising gets minor `SQ_NOT_UP`. Form measurements are kept across the rep, while `errors` describes the current or just-completed issue.

## Engine events (planned)

Events will be published through `src/events.js`. Event payloads are plain objects; subscribers must not mutate them.

G2.3b uses the existing camera, pose, and calibration events plus `rep` and `hint`. A `pose:result` payload is `{ landmarks, fps, timestampMs }`, where `landmarks` is the **smoothed** first detected pose or `null`. `pose:quality` carries the quality result and calibration state. `calibration:complete` carries the completed calibration object. `rep` carries `{ exercise: "squat", rep, clean, errors, durationMs, minAngle }` only for counted repetitions. `hint` carries `{ code, severity, joints }` for a newly active form issue, throttled per code to once per 4000 ms. The UI selects one correction by positioning, critical, then minor priority and holds it for at least 1500 ms.

Training flow events are `program:selected { programId }`, `workout:start` with the initial session state, `exercise:start { programId, exerciseId, index, targetReps }`, `exercise:complete { programId, exerciseId, reps, targetReps }`, `workout:rest { programId, seconds, nextExerciseId }`, `workout:complete` with final session state, and `workout:reset { programId }`.

| Event | Planned payload | Purpose |
| --- | --- | --- |
| `pose:visibility-changed` | `{ visible, reason }` | Show framing guidance or pause analysis |
| `exercise:phase-changed` | `{ exerciseId, phase }` | Update phase cues |
| `exercise:rep-completed` | `{ exerciseId, clean, errors, durationMs }` | Update counts and progress |
| `exercise:rep-rejected` | `{ exerciseId, errors, durationMs }` | Explain an uncounted cycle |
| `exercise:form-error` | `{ exerciseId, code, severity, joints }` | Show a specific correction |
| `app:error` | `{ code, message, recoverable }` | Show a clear recovery path |

## Error states (planned)

| Code | Meaning | Expected UI action |
| --- | --- | --- |
| `CAMERA_DENIED` | Camera permission was declined | Explain how to allow access and retry |
| `NO_CAMERA` | No camera was found | Explain device issue and retry |
| `CAMERA_ERROR` | Camera could not start for another reason | Explain device issue and retry |
| `INSECURE_CONTEXT` | Camera API unavailable in current context | Ask user to use localhost or HTTPS |
| `MODEL_FAILED` | Pose model could not initialize or inference stopped | Offer retry |
| `LOW_VISIBILITY` | Required body joints are outside the frame or obscured | Pause counting and show positioning guidance |
| `LOW_LIGHT` | Image quality is too poor for reliable tracking | Pause counting and show lighting guidance |
| `MULTI_PERSON` | More than one person is in view | Pause counting and request one person in frame |

G2.3b handles camera and model errors, framing and SIDE-view guidance, and the five squat form codes above.
