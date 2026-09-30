# Motion Quest

Motion Quest is a browser fitness game for the **Admit Hackathon Motion case**. Your body is the controller: the webcam and MediaPipe provide pose landmarks, while our own code smooths them, checks visibility, calibrates the user, and analyzes movements. Video stays on your device; the app does not upload camera frames.

The current motion foundation tracks **Squat, Arm Raise, Side Bend, and Push-up**. Squat has form feedback; the other analyzers currently count complete repetitions. Workout results, rest, and repeat flow are implemented. XP, quests, accounts, and a real backend are outside this foundation.

## Run locally

From the repository root:

```sh
python -m http.server 8000
```

On Windows without Python, use the bundled PowerShell server instead:

```sh
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

It serves `http://localhost:8123/`.

Open `http://localhost:8000/` in a browser and allow camera access. Use localhost or HTTPS; opening `index.html` directly may block camera access or ES modules. MediaPipe Tasks Vision and the Pose Landmarker Lite model are served from `vendor/mediapipe/`; no build step or CDN is needed.

## Workouts

| Workout | Exercises | Estimated time |
| --- | --- | --- |
| **Workout 1 — Full Body** | Squat 8 → Arm Raise 8 → Side Bend 10 | ~4 min |
| **Workout 2 — Strength** | Squat 10 → Push-up 5 → Arm Raise 10 | ~5 min |
| **Workout 3 — Light** | Arm Raise 8 → Side Bend 10 → Arm Raise 8 | ~3 min |

All three workouts are available. After calibration, select a workout, review its intro, and press **START TRAINING**. Each stage shows an exercise preparation view; press **START EXERCISE** before repetition tracking begins. After a target is reached, REST shows the next stage. **PREPARE NEXT EXERCISE** moves to its preparation view without starting recognition. Results show the workout number, exercise results, duration, and completed count. **REPEAT WORKOUT** clears counts and returns to the same workout's intro without restarting the camera.

## Architecture

`camera → MediaPipe landmarks → One Euro smoothing → pose quality/calibration → exercise analyzer → workout controller → app state/events → UI`

MediaPipe provides landmarks. Motion Quest owns all movement analysis. `src/exercises/` contains DOM-free, backend-free analyzers. `src/engine.js` owns one analyzer at a time. `src/programs.js` defines the numbered workouts; `src/workout.js` owns explicit session states and produces JSON results. `src/appState.js` and `src/events.js` expose the frontend integration boundary. `src/api.js` is an async, in-memory mock boundary for a future backend. Camera frames and landmarks never enter workout result data.

See [CONTRACT.md](./CONTRACT.md) for states, analyzer outputs, events, and result shape. See [INTEGRATION.md](./INTEGRATION.md) for frontend and backend teammate guidance.

## Collaboration

Start with [CONTRIBUTING.md](./CONTRIBUTING.md) for branches and Pull Requests. [ARCHITECTURE.md](./ARCHITECTURE.md) shows layer boundaries; [CORE_OWNERSHIP.md](./CORE_OWNERSHIP.md) lists protected motion files and [CORE_TESTS.md](./CORE_TESTS.md) is their regression checklist. Role-specific guidance is in [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) and [BACKEND_GUIDE.md](./BACKEND_GUIDE.md).

## Manual checks

1. Press START, allow the camera, and stand still until calibration finishes. **CHOOSE YOUR WORKOUT** should appear; no analyzer should start automatically.
2. Select each card. Confirm that it opens an intro with the correct exercise order and targets. Press BACK TO WORKOUTS, then select one again.
3. Press START TRAINING. Confirm the first **EXERCISE_READY** view appears and counts remain zero until START EXERCISE is pressed.
4. Complete Workout 1: Squat 8 from SIDE view → rest/prepare → Arm Raise 8 from FRONT view → rest/prepare → Side Bend 10 from FRONT view. Results should show 3 / 3.
5. Complete Workout 2: Squat 10 → Push-up 5 → Arm Raise 10. Before Push-up, position the camera for a full SIDE profile with shoulder, elbow, wrist, hip, and ankle visible. Results should show 3 / 3.
6. Complete Workout 3: Arm Raise 8 → Side Bend 10 → Arm Raise 8. Confirm the second Arm Raise starts at zero. Results should show 3 / 3.
7. On any Results screen, press REPEAT WORKOUT. Confirm the same workout intro returns, counts are cleared, and START TRAINING is required again.
8. Return to workout selection and start another program. BACK TO HOME should stop camera tracks; START should begin a fresh camera and calibration session. Check the browser console for uncaught errors.

For motion-specific checks, hold a bottom position, perform a shallow partial movement, briefly leave the required FRONT/SIDE view, and lose a required joint mid-cycle. None should create a phantom repetition. Squat uses pixel-corrected knee geometry and form thresholds; 2D camera angle and landmark occlusion can affect feedback. Push-up uses an exercise-specific visibility check so a horizontal body is not blocked by standing framing rules.

## Roadmap

| Gate | Focus |
| --- | --- |
| G1 | Splash and application contract |
| G2 | Camera, pose, smoothing, calibration, four movement analyzers, and workout flow |
| G3 | Form feedback and movement reliability |
| G4 | Game progression and navigation |
| G5 | Accessibility and recovery paths |
| G6 | Performance, verification, and release readiness |
