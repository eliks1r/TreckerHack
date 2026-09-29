# Architecture

The browser motion path flows in this direction:

```text
CAMERA
  ↓
POSE / FILTER
  ↓
QUALITY / CALIBRATION
  ↓
EXERCISE ANALYZERS
  ↓
ENGINE
  ↓
WORKOUT
  ↓
APP STATE / EVENTS
  ↓
UI
```

The persistence path is separate:

```text
WORKOUT RESULT
  ↓
src/api.js
  ↓
FUTURE BACKEND
```

Data may move **down** these diagrams. Low-level motion modules must never depend on UI or backend code; no circular dependencies. Camera and pose modules expose landmarks and quality, exercise analyzers turn smoothed landmarks into phases and rep results, the engine selects an analyzer, and the workout controller orchestrates stages and serializes results. `src/appState.js` and `src/events.js` provide a rendering boundary. `src/main.js` currently wires these layers to the DOM. Only a completed workout result reaches `src/api.js`; video frames and landmarks stay in the browser pose path.

The analyzer and workout contracts are in [CONTRACT.md](./CONTRACT.md). Team-specific edit boundaries are in [CORE_OWNERSHIP.md](./CORE_OWNERSHIP.md), [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md), and [BACKEND_GUIDE.md](./BACKEND_GUIDE.md).
