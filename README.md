# Motion Quest

Motion Quest is a browser-based fitness game for the **Admit Hackathon Motion case**: the player's body becomes the controller. The eventual experience will use a camera to recognize movement, give form feedback, and turn a workout into a quest. The G1 build is the visual foundation: a Splash screen and a CAMERA placeholder reached by pressing START.

The Splash screen states the intended privacy model: **“Video stays on your device.”** G1 does not open the camera, capture video, or send data anywhere.

## Architecture

The planned flow is `camera → MediaPipe landmarks → our movement analysis → engine events → interface`. MediaPipe will provide body landmarks. Our own code will implement filtering, geometry, movement phases, repetition decisions, and form analysis. See [CONTRACT.md](./CONTRACT.md) for module boundaries and planned data contracts.

Current files:

| File | Role |
| --- | --- |
| `index.html` | Splash and CAMERA placeholder markup |
| `styles.css` | Dark, responsive game style and design palette |
| `src/main.js` | Screen state and button behavior |
| `src/config.js` | Shared application states and event names |
| `src/events.js` | Local publish/subscribe event bus |
| `CONTRACT.md` | Planned analyzer, engine, and error interfaces |

## Run locally

This version has no dependencies or build step. Use a local HTTP server from the repository root, then open its localhost URL:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/`. Any static server that supports ES modules is fine. Opening `index.html` directly as a file may block module loading in some browsers.

## Test G1

1. Confirm the Splash shows **MOTION QUEST**, **“Your body is the controller.”**, **START**, and **“Video stays on your device.”**
2. Press START. The CAMERA placeholder should appear without a permission prompt.
3. Press **BACK TO SPLASH**. The Splash should return.
4. Check the layout at desktop and mobile widths, including keyboard focus on both buttons.

## Roadmap

| Gate | Planned milestone |
| --- | --- |
| G1 | Splash, visual system, screen state, architecture contract |
| G2 | Camera permission, pose landmark pipeline, framing and calibration |
| G3 | First movement analyzers, repetition counting, and form feedback |
| G4 | Quest flow, progression, and motion driven navigation |
| G5 | Wider exercise coverage, recovery paths, and accessibility polish |
| G6 | Testing, performance work, documentation, and release readiness |

Only G1 is implemented in this repository state. Later gate details may be refined as development proceeds.
