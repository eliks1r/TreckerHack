# Motion Quest contracts

This document defines the interfaces between modules. G2.2 adds smoothed landmarks, pose quality, view classification, and a neutral-stance calibration to the working camera pipeline. Exercise analyzers and the game engine remain planned.

## Architecture and module boundaries

The pipeline is `camera → MediaPipe raw landmarks → One Euro smoothing → pose quality and view → neutral calibration → UI`. Later analyzers will consume the smoothed landmarks and calibration context. MediaPipe supplies landmark positions; Motion Quest code owns movement analysis, phase detection, form rules, and feedback.

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
| Future analyzer modules | Movement phases, repetition validation, and form errors | Planned |
| Future engine | Convert analyzer output into events and application progress | Planned |

No module should send video frames off device. The UI receives state and engine events, rather than reading pose internals directly.

## Application states

| State | Meaning | Entry |
| --- | --- | --- |
| `SPLASH` | Initial screen with project title, privacy line, and START | App load or Back |
| `CAMERA` | Live webcam, pose tracking, framing guidance, calibration, or camera error | START |
| `CALIBRATION` | Possible future separate calibration screen; G2.2 calibrates inside CAMERA | Planned |
| `QUEST_SELECT` | Future motion-driven selection | Planned |
| `ACTIVE` | Future movement session | Planned |
| `PAUSED` | Future interruption or user pause | Planned |
| `RESULTS` | Future session summary | Planned |
| `ERROR` | Future recoverable or fatal issue screen | Planned |

Transitions are owned by `src/main.js` (or a future state controller). In G2.2, only `SPLASH ↔ CAMERA` is available. A state change emits `app:state-changed` with `{ state }`. Returning to Splash stops the pose loop, closes the landmarker, stops every camera track, resets smoothing, and clears calibration.

## Pose quality and calibration contract

`assessPoseQuality(landmarks, videoWidth, videoHeight)` receives **smoothed** normalized landmarks and returns `{ bodyDetected, fullBodyVisible, upperBodyVisible, missingJoints, framing, view, metrics }`. `framing` is one of `NO_BODY`, `PARTIAL_BODY`, `TOO_CLOSE`, or `READY`; `view` is `FRONT`, `SIDE`, or `UNKNOWN`. `metrics` includes normalized body height and pixel-corrected shoulder width, torso length, and their ratio. Framing takes priority over calibration, but the view label does not block calibration by itself.

`createCalibration().update(landmarks, quality, nowMs, videoWidth, videoHeight)` returns `{ state, progress, resetReason?, calibration? }`. It samples a visible neutral stance for 1500 ms while shoulder and hip midpoint drift stays under configured limits. `state` is `WAITING`, `READY`, `CALIBRATING`, or `CALIBRATED`. A completed result is `{ theta0, sw0, torsoLen, legLen, timestamp, derived: { up, start } }`; lengths are in video pixels and `theta0` is in degrees. The `derived` values are future thresholds only; no repetition analysis runs in G2.2. Invalid framing or movement resets the in-memory calibration.

## Analyzer output contract (planned)

Each future exercise analyzer will expose `analyze(landmarks, context)` and return one result per processed frame. `landmarks` will be a MediaPipe pose landmark array or `null`. `context` will include `videoWidth`, `videoHeight`, and monotonic `nowMs`; normalized x/y must be scaled to video dimensions before angle calculations.

```js
{
  visible: true,                 // false when required joints cannot be trusted
  phase: "up",                  // exercise-specific phase name
  reps: 0,                      // total counted repetitions
  cleanReps: 0,                 // counted repetitions without form failures
  errors: [                     // live feedback for the current frame
    { code: "EXAMPLE_CODE", severity: "minor", joints: [11, 13] }
  ],
  repEvent: null,               // or { clean, errors: [code], durationMs, counted }
  metrics: {}                   // exercise-specific numeric diagnostics
}
```

`repEvent` is non-null only when a repetition finishes or is rejected. `counted: false` marks a rejected cycle; counted repetitions increment `reps` exactly once. `errors` is for current visual feedback, while `repEvent.errors` summarizes that repetition. An analyzer must not award progress when `visible` is false.

## Engine events (planned)

Events will be published through `src/events.js`. Event payloads are plain objects; subscribers must not mutate them.

G2.2 uses `camera:ready`, `camera:error`, `pose:ready`, `pose:result`, `pose:error`, `pose:body-found`, `pose:body-lost`, `pose:quality`, `pose:view`, `calibration:start`, `calibration:progress`, `calibration:complete`, and `calibration:reset`. A `pose:result` payload is `{ landmarks, fps, timestampMs }`, where `landmarks` is the **smoothed** first detected pose or `null`. `pose:quality` carries the quality result and calibration state. `calibration:complete` carries the completed calibration object.

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

G2.2 handles camera and model errors plus on-screen framing guidance. Movement-specific form errors remain planned.
