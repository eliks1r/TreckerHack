# Motion Quest

Motion Quest is a browser-based fitness game for the **Admit Hackathon Motion case**: the player's body becomes the controller. The eventual experience will use a camera to recognize movement, give form feedback, and turn a workout into a quest. G2.2 adds smoothed pose tracking, framing guidance, front/side view detection, and neutral-standing calibration to the working webcam screen.

The Splash and camera screens state the privacy model: **“Video stays on your device.”** Camera frames are processed in the browser; this app does not upload them. START asks for camera permission, and BACK stops all camera tracks.

## Architecture

The current flow is `camera → MediaPipe landmarks → our One Euro smoothing → pose quality and calibration → interface`. MediaPipe provides body landmarks. Our own code implements filtering, geometry, visibility checks, view detection, and calibration; movement phases, repetition decisions, and form analysis come later. See [CONTRACT.md](./CONTRACT.md) for module boundaries and data contracts.

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

## Test G2.2

1. Confirm the Splash shows **MOTION QUEST**, **“Your body is the controller.”**, **START**, and **“Video stays on your device.”**
2. Press START and allow camera access. Check that the feed is visible and mirrored, the skeleton follows you, and FPS updates.
3. Stand still with your full body in frame. Confirm the status changes to **Hold still for calibration**, progress reaches 100% in about 1.5 seconds, and **Calibration complete** appears.
4. Move close to the camera: confirm **Move farther from the camera**. Move back, then cut both legs out of frame: confirm **Step back so your full body is visible**.
5. Face the camera and rotate sideways. Confirm the label changes between **VIEW: FRONT** and **VIEW: SIDE** when the shoulders and hips are visible; intermediate angles can show **VIEW: UNKNOWN**.
6. Return to a usable full-body position. Move during calibration and confirm progress resets. Small camera jitter should be visibly reduced while deliberate movement still responds promptly.
7. Press **BACK TO HOME**. Confirm the webcam indicator turns off. Press START again and confirm calibration begins at 0% with no saved result.
8. Deny permission once and check the recovery message. Re-enable permission through browser site settings. Check desktop and mobile layouts and the browser console for uncaught errors.

## Roadmap

| Gate | Planned milestone |
| --- | --- |
| G1 | Splash, visual system, screen state, architecture contract |
| G2 | Camera and pose pipeline (G2.1); smoothing, framing, view, and calibration (G2.2) |
| G3 | First movement analyzers, repetition counting, and form feedback |
| G4 | Quest flow, progression, and motion driven navigation |
| G5 | Wider exercise coverage, recovery paths, and accessibility polish |
| G6 | Testing, performance work, documentation, and release readiness |

G2.2 stops at pose quality and calibration. Exercise analysis, game progress, and hand controls are not implemented yet. View classification uses a simple 2D shoulder-to-torso ratio, so `UNKNOWN` is expected near the front/side boundary or when torso landmarks are not reliable. Calibration stays in memory for the current camera session only.
