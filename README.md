# Motion Quest

Motion Quest is a browser-based fitness game for the **Admit Hackathon Motion case**: the player's body becomes the controller. The eventual experience will use a camera to recognize movement, give form feedback, and turn a workout into a quest. G2.3a adds the first exercise analyzer: a SIDE-view squat state machine and live repetition counter.

The Splash and camera screens state the privacy model: **“Video stays on your device.”** Camera frames are processed in the browser; this app does not upload them. START asks for camera permission, and BACK stops all camera tracks.

## Architecture

The current flow is `camera → MediaPipe landmarks → our One Euro smoothing → pose quality and calibration → squat analyzer → rep event → interface`. MediaPipe provides body landmarks. Our own code implements filtering, geometry, visibility checks, view detection, calibration, and squat phase/repetition decisions. Form-error analysis comes later. See [CONTRACT.md](./CONTRACT.md) for module boundaries and data contracts.

Current files:

| File | Role |
| --- | --- |
| `index.html` | Splash and camera screen markup |
| `styles.css` | Dark, responsive game style and design palette |
| `src/main.js` | Screen state and button behavior |
| `src/camera.js` | Webcam permission, stream lifecycle, and camera errors |
| `src/pose.js` | MediaPipe PoseLandmarker and video frame loop |
| `src/filter.js` | One Euro smoothing per landmark coordinate |
| `src/poseQuality.js` | Visibility, distance, framing, and view codes |
| `src/calibration.js` | Stable neutral-standing calibration window |
| `src/geometry.js` | Pixel-corrected distance and angle helpers |
| `src/exercises/squat.js` | Squat state machine and repetition validation |
| `src/engine.js` | Current exercise owner and `rep` event publisher |
| `src/drawPose.js` | Transparent pose skeleton overlay |
| `src/config.js` | Shared states, events, and camera/pose settings |
| `src/events.js` | Local publish/subscribe event bus |
| `CONTRACT.md` | Planned analyzer, engine, and error interfaces |

MediaPipe Tasks Vision **0.10.35** is copied into `vendor/mediapipe/` with its WASM runtime. The Pose Landmarker Lite model is at `vendor/mediapipe/models/pose_landmarker_lite.task`. These files are served locally; the app does not load them from `node_modules` or a CDN. MediaPipe Tasks Vision is Apache-2.0 licensed. The Lite model comes from Google's MediaPipe model distribution.

## Run locally

There is no build step. Use a local HTTP server from the repository root, then open its localhost URL:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/`. Any static server that supports ES modules is fine. Opening `index.html` directly as a file may block module loading in some browsers.

Camera permission requires `localhost` or HTTPS. Opening `index.html` directly as a file will not work reliably.

## Test G2.3a

1. Confirm the Splash shows **MOTION QUEST**, **“Your body is the controller.”**, **START**, and **“Video stays on your device.”**
2. Press START and allow camera access. Check that the feed is visible and mirrored, the skeleton follows you, and FPS updates.
3. Stand still with your full body in frame until calibration reaches 100%. Turn sideways until **VIEW: SIDE**, then press **START SQUAT TEST**.
4. Perform five full squats. Confirm **REPS 5** and that the phase cycles UP → DOWN → BOTTOM → RISING → UP.
5. Stay standing and shift slightly: the count must stay fixed. Make a shallow bend that never reaches the bottom: it must not count.
6. Hold the bottom of a squat: the count must stay fixed. Return to standing: it should increase by exactly one.
7. Turn FRONT during a squat: counting must pause and the screen must say **Turn sideways to the camera**. Return SIDE and start a fresh full cycle.
8. Walk out of frame during an incomplete squat, then return after a moment: no phantom repetition should appear.
9. Press **END SQUAT TEST** and start another test: the counter and phase should reset. Press **BACK TO HOME** and check that the webcam indicator turns off; START should begin a fresh calibration.
10. Check desktop and mobile layouts and the browser console for uncaught errors.

## Roadmap

| Gate | Planned milestone |
| --- | --- |
| G1 | Splash, visual system, screen state, architecture contract |
| G2 | Camera and pose pipeline (G2.1); smoothing, framing, view, calibration (G2.2); squat counting (G2.3a) |
| G3 | First movement analyzers, repetition counting, and form feedback |
| G4 | Quest flow, progression, and motion driven navigation |
| G5 | Wider exercise coverage, recovery paths, and accessibility polish |
| G6 | Testing, performance work, documentation, and release readiness |

G2.3a counts basic complete squats only. It does not evaluate squat form, award XP, or run a quest. View classification uses a simple 2D shoulder-to-torso ratio, so `UNKNOWN` is expected near the front/side boundary or when torso landmarks are not reliable. Calibration and rep counts stay in memory for the current camera session only.
