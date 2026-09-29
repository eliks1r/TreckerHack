# Motion Quest

Motion Quest is a browser-based fitness game for the **Admit Hackathon Motion case**: the player's body becomes the controller. The eventual experience will use a camera to recognize movement, give form feedback, and turn a workout into a quest. G2.1 adds a real webcam and a live pose skeleton to the G1 Splash screen.

The Splash and camera screens state the privacy model: **“Video stays on your device.”** Camera frames are processed in the browser; this app does not upload them. START asks for camera permission, and BACK stops all camera tracks.

## Architecture

The planned flow is `camera → MediaPipe landmarks → our movement analysis → engine events → interface`. MediaPipe will provide body landmarks. Our own code will implement filtering, geometry, movement phases, repetition decisions, and form analysis. See [CONTRACT.md](./CONTRACT.md) for module boundaries and planned data contracts.

Current files:

| File | Role |
| --- | --- |
| `index.html` | Splash and CAMERA placeholder markup |
| `styles.css` | Dark, responsive game style and design palette |
| `src/main.js` | Screen state and button behavior |
| `src/camera.js` | Webcam permission, stream lifecycle, and camera errors |
| `src/pose.js` | MediaPipe PoseLandmarker and video frame loop |
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

## Test G2.1

1. Confirm the Splash shows **MOTION QUEST**, **“Your body is the controller.”**, **START**, and **“Video stays on your device.”**
2. Press START and allow camera access. Check that the feed is visible and mirrored.
3. Stand in view. Confirm **Body detected**, the live skeleton, and a changing FPS value.
4. Press **BACK TO HOME**. Confirm the webcam indicator turns off. Press START again and verify tracking resumes.
5. Deny permission once and check the clear recovery message. Re-enable permission through browser site settings.
6. Check desktop and mobile layouts and the browser console for uncaught errors.

## Roadmap

| Gate | Planned milestone |
| --- | --- |
| G1 | Splash, visual system, screen state, architecture contract |
| G2 | Camera permission and pose landmark pipeline (G2.1 complete); framing and calibration later |
| G3 | First movement analyzers, repetition counting, and form feedback |
| G4 | Quest flow, progression, and motion driven navigation |
| G5 | Wider exercise coverage, recovery paths, and accessibility polish |
| G6 | Testing, performance work, documentation, and release readiness |

G2.1 stops at camera and pose tracking. Exercise analysis, calibration, game progress, and hand controls are not implemented yet.
