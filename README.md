# Motion Quest

Motion Quest is a browser-based fitness game for the **Admit Hackathon Motion case**: the player's body becomes the controller. The eventual experience will use a camera to recognize movement, give form feedback, and turn a workout into a quest. The current development flow tracks Squat and Arm Raise within training programs, with rest and a session summary.

The Splash and camera screens state the privacy model: **“Video stays on your device.”** Camera frames are processed in the browser; this app does not upload them. START asks for camera permission, and BACK stops all camera tracks.

## Architecture

The pose flow is `camera → MediaPipe landmarks → our One Euro smoothing → pose quality and calibration → active exercise analyzer → rep/hint events → workout session → interface`. MediaPipe provides body landmarks. Our own code implements filtering, geometry, visibility checks, view detection, calibration, Squat and Arm Raise repetition decisions, and Squat form feedback. Program definitions are data in `src/programs.js`; `src/workout.js` owns session transitions without DOM access. See [CONTRACT.md](./CONTRACT.md) for module boundaries and data contracts.

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
| `src/exercises/squat.js` | Squat state machine, repetition validation, and form checks |
| `src/exercises/armraise.js` | FRONT-view Arm Raise state machine and repetition validation |
| `src/engine.js` | Current exercise owner and `rep`/`hint` event publisher |
| `src/programs.js` | Program definitions and exercise names |
| `src/workout.js` | Workout session state and completed exercise results |
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

## Test training flow

1. Press START, allow the camera, and stand still until calibration completes. **CHOOSE YOUR TRAINING** should appear.
2. Check the three cards. **Full Body Beginner** and **Desk Mode** are available as development workouts; **Strength** says COMING SOON and cannot be entered.
3. Select Full Body Beginner. Check **EXERCISE 1 / 3**, **SQUAT**, and **REPS 0 / 8**. Turn SIDE if prompted.
4. Perform eight counted squats. The counter must reach exactly **8 / 8** and move automatically to REST without a ninth rep.
5. Check the 20-second countdown and **NEXT: ARM RAISE**. Press NEXT EXERCISE; the live Arm Raise stage should show **EXERCISE 2 / 3**, **REPS 0 / 8**, **PHASE DOWN**, and **VIEW FRONT** after facing the camera.
6. Perform eight complete bilateral arm raises. The counter should reach exactly **8 / 8** and enter REST with **NEXT: SIDE BEND**. Press NEXT EXERCISE; Side Bend must show a coming-soon placeholder without a rep detector.
7. Press FINISH DEMO WORKOUT. The summary should list Squat and Arm Raise as completed, exercises completed 2 / 3, elapsed time, and Development workout. RETURN TO PROGRAMS should reset the session.
8. Select Full Body Beginner again. The Squat counter must restart at 0 / 8. RETURN TO PROGRAMS from the workout or rest view should also reset safely.
9. Select Desk Mode. Arm Raise should be the first tracked exercise at 0 / 8. After its target, Clap remains a coming-soon placeholder.
10. Press BACK TO HOME. The camera indicator should turn off. START should launch a fresh calibration. Check the browser console for uncaught errors.

## Arm Raise checks

Face the camera and raise both arms sideways from down to shoulder height, then lower fully. Five complete cycles should add five reps. Holding the top, returning before shoulder height, small shoulder movements, and one-frame pose spikes should not add reps. Turn SIDE during an incomplete rep and check that the screen says **Face the camera**; return FRONT and perform a fresh cycle. RETURN TO PROGRAMS and restart the workout to confirm the counter begins at zero.

## Squat regression checks

1. Confirm the Splash shows **MOTION QUEST**, **“Your body is the controller.”**, **START**, and **“Video stays on your device.”**
2. Press START and allow camera access. Check that the feed is visible and mirrored, the skeleton follows you, and FPS updates.
3. Stand still with your full body in frame until calibration reaches 100%. Select Full Body Beginner, then turn sideways until **VIEW: SIDE**.
4. Perform five controlled deep squats. Confirm **REPS 5 / 8**, **CLEAN REPS** increases, and the phase cycles UP → DOWN → BOTTOM → RISING → UP.
5. Stay standing and shift slightly: the count must stay fixed. Make a shallow bend that never reaches the bottom: it must not count.
6. Hold the bottom of a squat: the count must stay fixed. Return to standing: it should increase by exactly one.
7. Turn FRONT during a squat: counting must pause and the screen must say **Turn sideways to the camera**. Return SIDE and start a fresh full cycle.
8. Walk out of frame during an incomplete squat, then return after a moment: no phantom repetition should appear.
9. Press **RETURN TO PROGRAMS** and start Full Body Beginner again: the counter and phase should reset. Press **BACK TO HOME** and check that the webcam indicator turns off; START should begin a fresh calibration.
10. Complete a squat with a minimum knee angle between 100° and 125°. It should count but show `SQ_SHALLOW` guidance and not raise CLEAN REPS. A bend that never reaches 125° should still not count.
11. Deliberately move a knee past its toe and then lean the torso far forward in separate reps. Confirm knee/toe or shoulder/hip highlights and one concrete correction at a time. Foot index visibility is needed for knee-over-toe feedback.
12. Perform a rep under 900 ms but over the minimum count duration; check the minor speed warning and that it may still be clean. During a rising phase, hold knee angle around 145°–160° for over 1.5 seconds; check the stand-upright hint.
13. Repeat a form issue and hold the bad position. Check that the feedback does not flicker, a hint is held at least 1.5 seconds, and the same hint is not retriggered within 4 seconds. After three clean reps in a row, check for **CLEAN!**
14. Check desktop and mobile layouts and the browser console for uncaught errors.

## Roadmap

| Gate | Planned milestone |
| --- | --- |
| G1 | Splash, visual system, screen state, architecture contract |
| G2 | Camera and pose pipeline (G2.1); smoothing, framing, view, calibration (G2.2); squat counting (G2.3a); squat form feedback (G2.3b); training flow foundation |
| G3 | First movement analyzers, repetition counting, and form feedback |
| G4 | Quest flow, progression, and motion driven navigation |
| G5 | Wider exercise coverage, recovery paths, and accessibility polish |
| G6 | Testing, performance work, documentation, and release readiness |

Squat and Arm Raise are the implemented exercise analyzers. Side Bend, Clap, and Push-up appear in program data but never generate fake repetitions. Arm Raise counts motion cycles but does not classify form errors yet. The app does not award XP or run a quest. G2.3b Squat form checks use 2D camera geometry and initial thresholds, so camera angle, foot landmark visibility, and user proportions can affect feedback. Calibration and workout results stay in memory for the current camera session only.
